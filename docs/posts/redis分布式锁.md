---
title: Redis分布式锁从毛坯到别墅
date: 2025-03-08
tags: ['redis', '架构', '微服务']
description: 分布式锁是在分布式系统中用于协调多个进程或服务对共享资源访问的一种机制。它确保在任意时刻，只有一个服务实例能够获取锁并操作共享资源，从而避免数据不一致问题。本文探讨在实际应用中，分布式锁的逐步完善的过程，由浅入深
---
# Redis分布式锁从毛坯到别墅

## 一、分布式锁基础概念

### 1.1 什么是分布式锁

分布式锁是在分布式系统中用于协调多个进程或服务对共享资源访问的一种机制。它确保在任意时刻，只有一个服务实例能够获取锁并操作共享资源，从而避免数据不一致问题。

### 1.2 核心应用场景

1. **库存管理**：秒杀活动中防止商品超卖
2. **订单处理**：防止重复下单或并发修改
3. **定时任务**：确保集群中只有一个节点执行定时任务
4. **缓存更新**：防止缓存击穿或多节点同时更新缓存

### 1.3 分布式锁的核心要求

1. **互斥性**：任意时刻只能有一个客户端持有锁
2. **防死锁**：即使持有锁的客户端崩溃，锁也能被自动释放
3. **高可用**：锁服务必须保持高可用状态
4. **防误解锁**：客户端只能解锁自己持有的锁
5. **可重入性**：同一个客户端可以多次获取同一把锁

## 二、Redis分布式锁实现方式

### 2.1 基础实现（SETNX命令）

```lua
# 加锁
SETNX lock_key unique_value
# 释放锁
DEL lock_key
```

**存在的问题**：
1. 无法设置过期时间，客户端崩溃可能导致死锁
2. 解锁操作不够安全，可能误删其他客户端的锁
3. 加锁和设置过期时间不是原子操作

### 2.2 进阶实现（SET命令）

```lua
# 加锁（原子操作）
SET lock_key unique_value NX PX 10000

# 释放锁（Lua脚本保证原子性）
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

**改进点**：
1. 使用SET命令的NX和PX选项，实现原子性加锁并设置过期时间
2. 通过unique_value（通常是随机字符串）标识锁的持有者
3. 使用Lua脚本保证解锁的原子性，防止误删

### 2.3 Java实现示例

```java
public class RedisLock {
    private StringRedisTemplate redisTemplate;
    private String lockKey;
    private String uniqueValue;
    private long expireTime;
    
    public RedisLock(StringRedisTemplate redisTemplate, String lockKey, long expireTime) {
        this.redisTemplate = redisTemplate;
        this.lockKey = lockKey;
        this.uniqueValue = UUID.randomUUID().toString();
        this.expireTime = expireTime;
    }
    
    public boolean tryLock() {
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent(lockKey, uniqueValue, Duration.ofMillis(expireTime)));
    }
    
    public boolean unlock() {
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                        "return redis.call('del', KEYS[1]) else return 0 end";
        Long result = redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(lockKey),
            uniqueValue
        );
        return result != null && result == 1;
    }
}
```

## 三、Redisson实现分布式锁

### 3.1 基本使用

Redisson是一个在Redis基础上实现的Java驻内存数据网格，它提供了分布式锁的完整实现。

```java
// 配置Redisson客户端
Config config = new Config();
config.useSingleServer().setAddress("redis://localhost:6379");
RedissonClient redisson = Redisson.create(config);

// 获取锁
RLock lock = redisson.getLock("myLock");

try {
    // 尝试加锁，最多等待100秒，锁过期时间为30秒
    boolean isLocked = lock.tryLock(100, 30, TimeUnit.SECONDS);
    if (isLocked) {
        // 业务处理
        System.out.println("获取锁成功，执行业务逻辑");
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
} finally {
    // 释放锁
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

### 3.2 看门狗机制（核心特性）

#### 3.2.1 什么是看门狗

看门狗（Watchdog）是Redisson的一个重要特性，它是一个后台线程，用于自动延长锁的有效期，防止业务未完成时锁被释放。

- 默认锁的有效期为30秒
- 看门狗每10秒（默认值的1/3）检查一次，如果业务未完成，则自动续期到30秒

#### 3.2.2 工作原理

1. 当调用`lock()`或`tryLock(waitTime, -1, timeUnit)`时（leaseTime为-1），看门狗机制被激活
2. 看门狗线程定期检查锁是否仍被当前线程持有，如果是，则自动延长锁的过期时间
3. 当业务完成调用`unlock()`或线程终止时，看门狗停止工作

#### 3.2.3 配置方式

```java
Config config = new Config();
// 设置看门狗超时时间（毫秒）
config.setLockWatchdogTimeout(30000);
RedissonClient redisson = Redisson.create(config);
```

### 3.3 实际案例：订单处理防重复提交

```java
package com.example.service;  

import org.redisson.Redisson;  
import org.redisson.api.RLock;  
import org.redisson.api.RedissonClient;  
import org.redisson.config.Config;  

import java.util.concurrent.TimeUnit;  

public class OrderProcessService {  
    
    private final RedissonClient redisson;
    
    public OrderProcessService() {
        Config config = new Config();
        config.useSingleServer().setAddress("redis://localhost:6379");
        this.redisson = Redisson.create(config);
    }
    
    public boolean processOrder(String orderId) {
        String lockKey = "order:" + orderId;
        RLock lock = redisson.getLock(lockKey);
        
        boolean acquired = false;
        try {
            // 尝试获取锁，最多等待5秒，使用看门狗机制自动续期
            acquired = lock.tryLock(5, -1, TimeUnit.SECONDS);
            
            if (acquired) {
                System.out.println("获取锁成功，处理订单：" + orderId);
                
                // 模拟订单处理过程
                processOrderLogic(orderId);
                
                return true;
            } else {
                System.out.println("获取锁失败，订单正在处理中：" + orderId);
                return false;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.out.println("处理订单被中断：" + orderId);
            return false;
        } catch (Exception e) {
            System.out.println("处理订单异常：" + orderId + ", " + e.getMessage());
            return false;
        } finally {
            // 确保释放锁
            if (acquired && lock.isHeldByCurrentThread()) {
                lock.unlock();
                System.out.println("释放锁，订单处理完成：" + orderId);
            }
        }
    }
    
    private void processOrderLogic(String orderId) throws InterruptedException {
        // 模拟复杂业务逻辑执行
        System.out.println("开始处理订单业务逻辑: " + orderId);
        
        // 模拟订单验证
        Thread.sleep(1000);
        System.out.println("订单验证完成");
        
        // 模拟库存检查
        Thread.sleep(1000);
        System.out.println("库存检查完成");
        
        // 模拟支付处理
        Thread.sleep(3000);
        System.out.println("支付处理完成");
        
        // 模拟订单状态更新
        Thread.sleep(1000);
        System.out.println("订单状态更新完成");
    }
    
    public static void main(String[] args) {
        OrderProcessService service = new OrderProcessService();
        
        // 模拟两个线程同时处理同一个订单
        String orderId = "ORD12345";
        
        Thread t1 = new Thread(() -> {
            boolean result = service.processOrder(orderId);
            System.out.println("线程1处理结果: " + result);
        });
        
        Thread t2 = new Thread(() -> {
            boolean result = service.processOrder(orderId);
            System.out.println("线程2处理结果: " + result);
        });
        
        t1.start();
        
        // 稍微延迟启动第二个线程
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        
        t2.start();
    }
}
```

### 3.4 自旋锁实现（等待锁释放）

以下是一个使用自旋方式等待锁释放的示例：

```java
package com.example.service;  

import org.redisson.Redisson;  
import org.redisson.api.RLock;  
import org.redisson.api.RedissonClient;  
import org.redisson.config.Config;  

import java.util.concurrent.TimeUnit;  

public class RedissonLockRenewalDemo {  

    private static final int HANDLE_TIME = 2000; // 最长等待时间（需大于业务执行时间）  
    private static final int SPIN_INTERVAL_MS = 1000; // 自旋间隔时间  

    public static void main(String[] args) {  
        // 启动两个线程模拟两个客户端  
        Thread client1 = new Thread(() -> processOrder("123123123"));  
        Thread client2 = new Thread(() -> processOrder("123123123"));  

        client1.start();  
        client2.start();  
    }  

    private static void processOrder(String orderId) {  
        Config config = new Config();  
        config.useSingleServer().setAddress("redis://localhost:6379");  
        RedissonClient redisson = Redisson.create(config);  

        RLock lock = redisson.getLock("order:" + orderId);  

        boolean acquired = false;  
        try {  
            // 自旋等待锁
            while(!(acquired = lock.tryLock(SPIN_INTERVAL_MS, -1, TimeUnit.MILLISECONDS))) {  
                System.out.println(Thread.currentThread().getName() + " 等待锁...");  
            }  

            if (acquired) {  
                System.out.println(Thread.currentThread().getName() + " 加锁成功");  
                for (int i = 1; i <= 5; i++) {  
                    System.out.println(Thread.currentThread().getName() + " Doing work... Step " + i);  
                    Thread.sleep(1000);  
                }  
            }  
        } catch (InterruptedException e) {  
            throw new RuntimeException(e);  
        } finally {  
            if (acquired && lock.isHeldByCurrentThread()) {  
                lock.unlock();  
                System.out.println(Thread.currentThread().getName() + " 释放锁");  
            }  
            redisson.shutdown();  
        }  
    }  
}
```

## 四、锁续期机制详解

### 4.1 为什么需要锁续期

在分布式环境中，锁的续期解决了以下问题：

1. **长任务处理**：当任务执行时间不可预测或可能超过锁的初始超时时间
2. **系统延迟**：网络延迟、GC暂停等可能导致任务执行时间延长
3. **防止锁过早释放**：避免任务执行过程中锁被自动释放，导致其他进程获取锁

### 4.2 Redisson看门狗续期原理

1. **初始锁定**：获取锁时，Redis中设置键值对，默认过期时间30秒
2. **后台监控**：看门狗线程每10秒检查一次锁状态
3. **自动续期**：如果线程仍持有锁，则重新设置过期时间为30秒
4. **释放机制**：调用unlock()或客户端崩溃，看门狗停止工作，锁最终过期释放

### 4.3 锁续期的最佳实践

1. **合理设置初始超时时间**：
   - 应大于绝大多数情况下的业务执行时间
   - 考虑网络延迟和系统负载因素

2. **选择合适的续期策略**：
   - 短任务（<10秒）：明确指定锁超时时间，不使用看门狗
   - 长任务（>10秒）：使用看门狗机制自动续期

3. **避免无限续期**：
   - 确保业务代码有超时控制
   - 在finally块中正确释放锁
   - 添加异常处理机制

### 4.4 锁续期配置示例

```java
// 全局配置看门狗超时时间
Config config = new Config();
config.setLockWatchdogTimeout(30000); // 30秒，单位毫秒
RedissonClient redisson = Redisson.create(config);

// 使用看门狗（自动续期）
RLock lock = redisson.getLock("myLock");
lock.lock(); // 或 lock.tryLock(waitTime, -1, timeUnit)

// 不使用看门狗（指定固定过期时间）
lock.tryLock(0, 10, TimeUnit.SECONDS); // 10秒后自动释放，不续期
```

## 五、常见问题与解决方案

### 5.1 锁超时问题

**问题**：业务执行时间超过锁的有效期，导致其他客户端可能获取锁

**解决方案**：
1. 使用看门狗机制自动续期
2. 合理设置锁超时时间
3. 优化业务逻辑，减少执行时间
4. 实现自定义续期逻辑

### 5.2 死锁问题

**问题**：客户端崩溃或网络问题导致锁无法释放

**解决方案**：
1. 始终设置锁的过期时间
2. 使用看门狗机制
3. 在finally块中确保解锁
4. 实现锁的强制释放机制

### 5.3 性能问题

**问题**：高并发下锁竞争激烈，影响系统性能

**解决方案**：
1. 使用分段锁减少锁粒度（如按用户ID哈希分段）
2. 使用读写锁区分读操作和写操作
3. 优化业务逻辑减少锁的持有时间
4. 考虑使用本地缓存减少分布式锁的使用频率

### 5.4 锁误释放问题

**问题**：客户端错误地释放了其他客户端持有的锁

**解决方案**：
1. 使用唯一标识（如UUID）标记锁的持有者
2. 使用Lua脚本保证检查和释放的原子性
3. 在释放前验证当前线程是否持有锁

### 5.5 集群环境问题

**问题**：Redis集群环境下锁的一致性问题

**解决方案**：
1. 使用Redlock算法（在多个独立Redis实例上获取锁）
2. 使用Redis集群版本3.0+的WAIT命令确保数据同步
3. 考虑使用专门的分布式协调服务如ZooKeeper或etcd

## 六、Redis分布式锁与其他实现的对比

| 特性 | Redis | ZooKeeper | etcd |
|------|-------|-----------|------|
| 性能 | 高 | 中 | 中 |
| 可靠性 | 中（主从复制可能丢数据） | 高（CP系统） | 高（CP系统） |
| 实现复杂度 | 低 | 高 | 中 |
| 自动续期 | 需自行实现或使用Redisson | 原生支持（临时节点） | 原生支持（租约机制） |
| 监听机制 | 需自行实现 | 原生支持（Watcher） | 原生支持（Watch） |
| 适用场景 | 高性能、短期锁 | 高可靠性、长期锁 | 高可靠性、配置管理 |

## 七、总结

1. Redis分布式锁是一种轻量级、高性能的分布式协调机制，适合对性能要求高的场景
2. Redisson提供了完善的分布式锁实现，包括看门狗自动续期机制
3. 锁续期是解决长任务和系统不稳定问题的关键机制
4. 正确使用分布式锁需要注意：
   - 合理的锁粒度设计
   - 适当的超时时间配置
   - 正确的异常处理机制
   - 防止死锁的安全措施
   - 在finally块中释放锁

5. 在实际应用中，应根据业务特性选择合适的分布式锁实现和配置，平衡性能与可靠性需求

通过合理使用Redis分布式锁及其续期机制，可以有效解决分布式系统中的并发控制问题，保证数据一致性和系统稳定性。
