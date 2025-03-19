---
title: 阿里云ECS操作实战
date: 2025-03-19
tags: ['MySQL','阿里云','运维','redis', 'docker']
description: 在云服务器上快速部署和管理服务是开发者和运维人员的常见需求。本文将详细介绍如何在阿里云 ECS 实例上 **重置密码**、**安装 Docker**，并使用 Docker 部署 Redis 和 MySQL，同时确保数据持久化和服务的高效管理。
---

# 在阿里云 ECS 上使用 Docker 部署 Redis 和 MySQL

## 引言
想象一下，你刚刚接手了一个新项目，需要快速搭建开发环境。项目需要 Redis 做缓存，MySQL 存储数据，但你不想花太多时间在环境配置上。别担心！本文将手把手教你如何在阿里云 ECS 上使用 Docker 快速部署这些服务，让你能在最短时间内专注于业务开发。

本文将通过一个完整的实战案例，详细介绍如何在阿里云 ECS 实例上重置密码、安装 Docker，并使用 Docker 部署 Redis 和 MySQL。我们不仅会讲解每个步骤的操作方法，还会分享一些实用的运维小贴士，帮你避开常见的坑。

---

## 准备工作
在开始动手之前，请确保你已经准备好：
- 一台阿里云 ECS 实例（如果还没有，可以先去阿里云官网开通一台）
- 已通过 SSH 连接到 ECS 实例（新手可参考 [阿里云官方文档](https://help.aliyun.com/document_detail/25434.html)）

> 💡 小贴士：建议选择 2核4G 或更高配置的实例，这样可以保证 Docker 容器运行流畅。

---

## 步骤 1：重置 ECS 实例密码
场景：假设你刚接手一台服务器，但前任管理员已离职，密码不可用。不用着急，让我们先来解决访问权限的问题：

1. **登录阿里云控制台**  
   进入 [ECS 控制台](https://ecs.console.aliyun.com/)。

2. **找到目标实例**  
   在实例列表中找到需要重置密码的 ECS 实例。

3. **重置密码**  
   - 点击实例右侧的 **更多**，选择 **密码/密钥** -> **重置实例密码**。
   - 输入新密码并确认。

4. **重启实例**  
   重置密码后，需要重启实例使新密码生效。点击 **更多** -> **实例状态** -> **重启**。

5. **使用新密码登录**  
   使用新密码通过 SSH 连接到 ECS 实例。

---

## 步骤 2：安装 Docker

### 2.1 更新系统包
就像装修新房子前要先打扫干净一样，安装 Docker 前，我们需要先更新系统包，确保环境干净且最新：
```bash
# Ubuntu/Debian 系统使用这条命令
sudo apt update && sudo apt upgrade -y  # 更新软件包列表并升级所有可更新的软件

# CentOS/RHEL 系统使用这条命令
sudo yum update -y                     # -y 参数表示自动确认，无需手动确认更新
```

### 2.2 安装 Docker 依赖
在开始安装 Docker 之前，我们需要先准备好"工具箱"：
```bash
# Ubuntu/Debian 系统需要安装这些基础工具
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
# apt-transport-https：允许通过HTTPS使用仓库
# ca-certificates：允许SSL-based应用程序检查连接安全性
# curl：传输数据工具
# software-properties-common：添加和删除仓库的工具

# CentOS/RHEL 系统使用这条命令
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
# yum-utils：提供yum-config-manager等工具
# device-mapper-persistent-data和lvm2：Docker的存储驱动依赖
```

> 💡 小贴士：如果安装过程中遇到锁定错误，可能是系统在进行自动更新，稍等片刻再试即可。

### 2.3 添加 Docker 官方仓库
#### **Ubuntu/Debian**
1. 添加 Docker 官方 GPG 密钥：
   ```bash
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
   ```
2. 添加 Docker 仓库：
   ```bash
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   ```

#### **CentOS/RHEL**
添加 Docker 仓库：
```bash
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

### 2.4 安装 Docker
更新包列表并安装 Docker：
```bash
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io  # Ubuntu/Debian
sudo yum install -y docker-ce docker-ce-cli containerd.io                    # CentOS/RHEL
```

### 2.5 启动 Docker 服务
安装完成后，启动 Docker 并设置开机自启：
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### 2.6 验证 Docker 安装
运行以下命令验证 Docker 是否安装成功：
```bash
sudo docker --version
```
如果显示 Docker 版本信息，说明安装成功。

### 2.7 将当前用户加入 Docker 组
为了避免每次使用 Docker 都需要 `sudo`，可以将当前用户加入 Docker 组：
```bash
sudo usermod -aG docker $USER
```
然后退出 SSH 重新登录，使配置生效。

---

## 步骤 3：安装 Redis

### 3.1 拉取 Redis 镜像
想象 Docker Hub 就像是一个巨大的应用商店，我们可以直接从里面下载需要的应用。让我们先把 Redis 的"安装包"下载下来：
```bash
docker pull redis  # 不指定版本号默认拉取最新版本
# 如果需要特定版本，可以使用：docker pull redis:6.2.7
```

### 3.2 运行 Redis 容器
现在，让我们把 Redis 运行起来。就像在手机上安装 App 一样简单：
```bash
docker run -d --name my-redis -p 6379:6379 redis

# 参数说明：
# -d：让容器在后台运行
# --name my-redis：给容器起个好记的名字
# -p 6379:6379：把容器内的6379端口映射到主机的6379端口
```

> 💡 小贴士：在生产环境中，建议给 Redis 设置密码。可以通过添加参数实现：
> ```bash
> docker run -d --name my-redis -p 6379:6379 redis --requirepass your_password
> ```

### 3.3 验证 Redis 运行
检查容器是否正常运行：
```bash
docker ps
```
进入 Redis 容器并测试连接：
```bash
docker exec -it my-redis redis-cli
ping
```
如果返回 `PONG`，说明 Redis 正常运行。

### 3.4 持久化 Redis 数据
为了持久化 Redis 数据，可以使用 Docker 卷：
```bash
mkdir -p /data/redis
docker run -d --name my-redis -p 6379:6379 -v /data/redis:/data redis
```

---

## 步骤 4：安装 MySQL

### 4.1 拉取 MySQL 镜像
从 Docker Hub 拉取 MySQL 5.7 镜像：
```bash
docker pull mysql:5.7
```

### 4.2 运行 MySQL 容器
启动 MySQL 容器并设置 root 用户密码：
```bash
docker run -d --name my-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=yourpassword mysql:5.7
```

### 4.3 验证 MySQL 运行
检查容器是否正常运行：
```bash
docker ps
```
进入 MySQL 容器并测试连接：
```bash
docker exec -it my-mysql mysql -uroot -p
SHOW DATABASES;
```

### 4.4 持久化 MySQL 数据
为了持久化 MySQL 数据，可以使用 Docker 卷：
```bash
mkdir -p /data/mysql
docker run -d --name my-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=yourpassword -v /data/mysql:/var/lib/mysql mysql:5.7
```

---

## 步骤 5：使用 Docker Compose 管理服务

### 5.1 安装 Docker Compose
下载并安装 Docker Compose：
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 5.2 创建 `docker-compose.yml` 文件
创建一个 `docker-compose.yml` 文件来定义 Redis 和 MySQL 服务：
```yaml
version: '3'
services:
  redis:
    image: redis
    container_name: my-redis
    ports:
      - "6379:6379"
    volumes:
      - /data/redis:/data

  mysql:
    image: mysql:5.7
    container_name: my-mysql
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: yourpassword
    volumes:
      - /data/mysql:/var/lib/mysql
```

### 5.3 启动服务
使用 Docker Compose 启动服务：
```bash
docker-compose up -d
```

### 5.4 查看运行状态
检查服务运行状态：
```bash
docker-compose ps
```


## 结语
通过本文的步骤，你可以在阿里云 ECS 实例上 **重置密码**、**安装 Docker**，并快速部署和管理 Redis 和 MySQL 服务。使用 Docker 不仅简化了安装和配置过程，还提供了数据持久化和服务管理的便利性。希望这篇博客对你有所帮助，如果有任何问题，欢迎留言讨论。
