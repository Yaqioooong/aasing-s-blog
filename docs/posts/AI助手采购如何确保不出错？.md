---
title: AI采购助手如何确保下单不出错？
date: 2026-10-26
tags: ['Agents','LangGraph','PostgreSQL','工程化','harness']
description: 随着 AI Agent 逐步深入企业核心业务，如何确保 AI 在处理敏感数据、执行关键业务操作时的准确性与可靠性，成为 AI 落地过程中必须解决的工程问题。尤其是在采购等涉及金额、供应商信息和审批流程的场景中，AI 的一次错误操作就可能造成实际的业务损失。本文将以 AI 采购场景为切入点，从系统设计与工程实践出发，探讨如何通过权限控制、数据校验、规则引擎、风险拦截、人工介入等机制，构建可靠的 AI 服务，尽可能降低 AI 的错误率，使其在安全性与执行准确性上达到甚至超越人工水平。
---

# 从自然语言需求到可审批、可恢复、可核验的订单链路

> AI 采购助手的可靠性，不来自“让模型更谨慎”，而来自“模型负责提出方案，系统负责校验、审批、执行及核验”

## 一次“成功”的下单，可能藏着三个隐患
>
> 采购员让AI 采购助手帮忙采购200个零件，采购助手通过MCP 调用了ERP 的下单接口，但接口响应超时，采购助手决定重试一次，结果下了两次单

周一上午10:35，采购员对AI助手说：“给华东仓补充200个活塞环组件，总预算不超过5万元”，几秒钟后，助手完成了库存查询，供应商比价和金额计算，并生成了一条采购建议：

```text
物料：活塞环组件
供应商：A 公司
数量：200
单价：100 元
总价：20,000 元
收货仓库：华东仓
```

采购员点击确认，ERP系统收到了创建订单的请求，但返回响应前，网络超时了，这时AI助手面临一个抉择：

- 如果认为请求失败并立即重试，ERP可能重复创建订单
- 如果认为请求成功，并直接结束，订单可能根本没有落库
- 如果只看到“接口超时”，系统其实无法判断最终结果

在这个例子里，真正的问题不是“模型不够聪明”，而是系统没有能力去分三种完全不同的状态：确认失败、确认成功、结果未知

在AI问答场景中，AI可以生成一段看起来正确的话（有概率是幻觉）；但实际采购场景则不同，AI做的采购决策会变成真实的库存变更、财务付款、订单合同、供应商履约。错误的采购决策对企业造成的损失无疑是巨大的

因此，本篇博客不打算讨论如何写一个更谨慎的提示词，而是回答一个工程问题：
> 当模型必须参与采购决策时，怎样让它在关键环节“可以建议，但不能擅自决定”？

答案可以浓缩成一句话：**模型负责提出方案，确定性代码负责校验，业务系统负责裁决，人可以审批和复核。**

## 一：先确保系统没有理解错、算错、问错

一次可靠的采购，首先取决于最前面的三个问题：

1. 用户说的信息，系统有没有理解正确？
2. 用于决策的数据，系统有没有如实使用？
3. 信息不足时，系统是追问，还是擅自补全？

如果没有解决这三件事，后面的审批、幂等和核验都是在一个错误的方向做正确的事

### 1. AI 采购男的不只是“模型会不会胡说”

采购助手面对的不确定性，至少有三层。

#### 第一层：语言本身不完整

用户可能说：”上次那种活塞环再来一批“，这里缺少物料编码、具体数量和收货仓库，即使模型根据上下文猜出了”上次是200个“，也不代表这次仍然采购200个。

采购场景的一个基本原则：**没有明确给出的业务字段，不能由模型补默认值**，因为默认值一旦进入订单，就不再是“猜测”，而是会变成真实的业务动作

#### 第二层：业务事实可能缺失或过期

即使需求说清楚了，系统仍可能遇到：

- 物料查不到
- 供应商已停止合作
- 报价缺失
- 库存数据来自其他仓库
- 价格已变化
- 查询接口超时

这些问题不应该被包装成“分析结论”。例如，没有拿到报价时，正确行为不是根据历史价格推算一个“可能合理”的单价，而是明确标记数据不可用，停止生成可审批的方案。

#### 第三层：执行有真实的业务副作用

查询库存可以重试，但创建订单不能简单重试。一次HTTP请求超时，可能只是客户端没有收到响应，ERP却已经成功创建了订单，此时最危险的代码往往很短：

```python
try:
    await erp.create_order(order)
except TimeoutError:
    await erp.create_order(order)
```

看上去是在容错，实际上可能把一个超时变成重复下单。采购可靠性不是某一层的属性，而是整个下单链路的属性：**理解、数据、计算、审批、执行、核验，任何一个环节都不能把“不确定”当作“成功”**

### 2. 先划清边界：模型建议，系统裁决

本项目没有让主Agent自由决定所有业务步骤，而是采用混合设计：

- Agent负责理解用户意图、选择工具、提出采购建议
- 确定性代码负责金额计算、库存缺口、字段校验和权限判断
- LangGraph 固定关键业务数据流程，确保审批、执行和核验节点不能随意跳过
- 人工审批负责对具体方案做业务决定
- ERP和业务数据库提供最终事实

简化版的系统全景图：

![系统全景图](../imgs/whiteboard_exported_image%20(1).png)

这个结构的关键不在于用了多少个Agent, 而是在于边界是否明确：

> 模型可以解释“为什么选择这家供应商”，但不能决定“总价是多少”
>
> 模型可以建议采购200个，但不能决定“数量字段缺失时，默认也是200个”
>
> 模型可以发起订单草稿，但不能绕过审批和幂等规则直接创建订单

### 3. 第一层防线：把自然语言变成可校验的数据

自然语言需求进入系统后，第一件事不是立刻查询ERP， 而是转换成结构化对象，项目中有一个专门的需求解析器，负责把用户输入提取成PricurementRequest。核心约束写在系统提示词中：

```text
1. 只提取用户明确表达的信息，不要猜测缺失字段
2. 数量必须是用户给出的数字，不要自行换算单位
3. 仓库只提取用户明确说明的仓库/库位
4. 预算只在用户明确给出时填写
5. 物料名称、型号、编码保留原文，不要改写
6. 如果本轮是补充上一轮信息，请把补充内容合并到previous_request，保留未修改字段
7. 无法确定的字段留空，由后续校验流程向用户追问
```

这段提示词解决的是“模型应该怎样做”，但提示词本身不能保证模型一定照做，所以解析结果还要经过Pydantic校验：

```python
message = await self._model.ainvoke(messages)
text = _content_to_text(getattr(message,"content",message))
return ProcurementRequest.model_validate(extract_json(text))
```

如果模型输出了不合法的JSON、字段类型不对或是没有按照要求返回结构化对象，解析器就会要求模型重试一次，而不是把一个坏对象继续传下去。这里有两点值得强调：

1. 不依赖模型“看起来像JSON”,必须真正解析并通过数据结构校验
2. 重试有次数上限，解析失败不能无限循环，否则所谓容错会变成任务卡死

### 4. 信息不全时，最安全的能力是向用户追问

结构化解析出来后，系统还会执行字段级业务校验，例如：

- 是否至少有一个采购物料？
- 每个物料是否有名称、编码或ID?
- 数量是否指明且合法？
- 是否明确指定了收货仓库？
- 预算是否为正数？
- 要求到货日期是否已过去？

以数量为例：

```python
if item.quantity is None:
    issues.append(
        issue(
            "REQUEST_QUANTITY_MISSING",
            "需要采购数量。",
            field=f"{prefix}.quantity",
            fixable=True,
        )
    )
elif item.quantity <= 0:
    issues.append(
        issue(
            "REQUEST_QUANTITY_INVALID",
            "采购数量必须大于 0。",
            field=f"{prefix}.quantity",
            fixable=True,
        )
    )
elif item.quantity > PROCUREMENT_MAX_QUANTITY:
    issues.append(
        issue(
            "REQUEST_QUANTITY_TOO_LARGE",
            f"采购数量超过上限 {PROCUREMENT_MAX_QUANTITY}，请拆分或确认。",
            field=f"{prefix}.quantity",
            fixable=True,
        )
    )
```

这里不返回“默认值”，也不让Agent自己猜。而是用一个fixable字段进行标记，如果fixable == True，流程图会进入人工补充节点

```python
# ----------------------------nodes.py---------------------------------
# --------------------------------------------------------
# validate_request
# --------------------------------------------------------
async def validate_request(state, runtime):
    if not _owner_ok(state, runtime):
        return _failed("FORBIDDEN", "当前用户无权操作该采购任务。")
    request = ProcurementRequest.model_validate(state.get("request") or {})
    issues = validate_request_fields(request, today=deps.now().date())
    if issues and state.get("clarification_round", 0) >= deps.max_clarification_rounds:
        return _failed(
            "CLARIFICATION_LIMIT_REACHED",
            f"已追问 {deps.max_clarification_rounds} 轮仍未补全采购条件，请重新发起任务。",
        )

    if issues:
        return {
            "missing_fields": [i.field for i in issues if i.fixable and i.field],
            "validation_errors": [i.model_dump() for i in issues],
            "status": TaskStatus.NEED_INFO.value,
            "node_history": ["validate_request"],
            "updated_at": deps.now().isoformat(),
        }
    return {
        "missing_fields": [],
        "validation_errors": [],
        "status": TaskStatus.ANALYZING.value,
        "node_history": ["validate_request"],
        "updated_at": deps.now().isoformat(),
    }


# ----------------------------routing.py---------------------------------
# validate_request节点不通过时，路由到askuser
def after_validate_request(state) -> str:
  if state.get("status") == TaskStatus.FAILED.value:
      return "fail"
  if state.get("status") == TaskStatus.NEED_INFO.value:
      return "ask_user"
  return "analyze"


# ----------------------------nodes.py---------------------------------
# --------------------------------------------------------
# ask_user：只 interrupt，不写任何外部状态
# --------------------------------------------------------
async def ask_user(state, runtime):
  if not _owner_ok(state, runtime):
      return _failed("FORBIDDEN", "当前用户无权操作该采购任务。")
  answer = interrupt(
      {
          "type": "procurement_clarification",
          "task_id": state["task_id"],
          "missing_fields": state.get("missing_fields", []),
          "validation_errors": state.get("validation_errors", []),
          "current_request": state.get("request", {}),
          "question": "请补充以上采购条件；没有把握的字段请明确说明，不要猜测。",
      }
  )
  return {
      "clarification_answer": answer,
      "status": TaskStatus.NEED_INFO.value,
      "node_history": ["ask_user"],
      "updated_at": deps.now().isoformat(),
      }

```

在前端体验上，这会表现为一次明确的信息补充请求：

```text
缺少：warehouse_location

请补充收货仓库，例如：华东仓 / B区-1号库
```

### 5. 二次修改不能破坏第一次理解

用户看到结构化需求后，可能会修改其中一个字段，例如：“数量改成300，其他不变”

此时系统不能从零重新解析整条消息，也不能丢掉之前已经确认的物料和仓库，项目对这种情况做了两层处理：

- 如果前端提供结构化布丁，直接进行确定性深合并
- 如果时自由文本补充，则把原来的请求和补充内容一起交给模型，并要求保留未修改的字段

```python
# 如果前端直接给 request_patch，优先做确定性合并，避免再调一次模型
if isinstance(answer, dict) and isinstance(answer.get("request_patch"), dict):
  data = previous.model_dump(mode="json")
  _deep_merge(data, answer["request_patch"])
  return ProcurementRequest.model_validate(data)

# 自由文本补充，用模型合并
return await self.parse(
  raw_text="",
  previous=previous.model_dump(mode="json"),
  answer=answer,
)
```

这让“修改”变成对同一份采购任务的增量更新，而不是产生一份无法追溯的新需求。

## 二：方案可以不完美，但不能算错、审错

第一部分结束时，系统已经拿到了一份明确的采购需求

```text
物料：活塞环组件
数量：200
仓库：华东仓
预算：50,000元
```

接下来，AI要回答一个更接近真实业务的问题：

> 应该向哪家供应商采购？买多少？单价和总价是多少？现有库存够不够？这个方案是否真正可执行？

这一步看似是AI 最擅长的地方--找资料、做比较、给建议；但采购方案里会涉及数字和业务约束，而模型却不能成为这些数字的最终裁判，这一步我们要建立三层防线：

1. 分析只能建立在真实查询到的数据上
2. 金额和库存缺口由确定性代码计算，并对结果进行复核
3. 人工审批必须绑定到“某一版具体方案”，不能审批一个含糊的采购意图

### 6. 先建立候选集，再让模型“选”

可靠的采购分析不是从一句“建议选择A供应商”开始的，而是从一组可追溯的事实开始。系统查询ERP后，会把结果整理成CandidateSet, 主要包括：

- 物料真实的part_id
- 指定仓库的库存快照
- 各供应商对相应物料的报价
- 供应商状态、交期和信用等级
- 数据的来源与查询时间

这一步的一个准则是：**不在候选数据里的物料、报价和供应商，不能出现在最终方案里。**

例如：用户说的是“活塞环”，系统查询后发现多个同名物料，选择停止并报PART_AMBIGUOUS, 而不是自动跳一个看起来最合适的ID。

库存也有类似的约束，假设用户明确要求华东仓，但系统只查到了B区仓库的库存，这时不能把B区仓库借来充当华东仓的可用库存，代码会明确返回“库存未知”

```python
if exact:
  return exact[0]
if warehouse_location:
  # 指定仓库时不能用其他仓库的库存冒充可用库存。
  return None
```

但在采购系统中，未知 比一个编造出来的数字更可靠。因为前者会提示审批人确认，后者会让人误以为库存完全足够。

#### 让模型建议，让确定性代码选择

项目中还在方案推荐阶段使用了确定性的候选供应商打分器：

```python
c["score"] = (
  w_price * norm(c["total_price"], price_min, price_max)
  + w_lead * norm(lead_value, lead_min, lead_max + 1)
  + w_risk * c["risk"]
)
```

用户可以自己设置采购偏好，设置price, lead_time或balanced偏好，调整价格、交付日期和供应商风险的权重。

为什么不让模型直接比较？因为模型可以虽然解释哪个更好，但没有用同一套量化标准进行评估，在后期重复决策、审计时是不好解释的。

### 7. 金额不能看起来合理，必须算出来

假设模型生成了一条采购建议：

```text
数量：200
单价：100 元
小计：20,000 元
总价：200,000 元
```

这段文本在语言上没有问题，但业务上明显错误，人工审批者很容易忽略，不能单纯地将这种检查寄希望于人的注意力

项目中采用Decimal重新计算金额：

```python
def q2(value: Decimal) -> Decimal:
  # 将一个 Decimal 数值量化（四舍五入）到指定的精度，具体来说通常是保留两位小数、并采用"四舍五入"规则。
  return value.quantize(MONEY, rounding=ROUND_HALF_UP)


...
def recompute_plan_amounts(plan):
  """按明细逐项重算小计和总价，不信任方案里自带的金额。"""
  for index, item in enumerate(plan.items):
      expected_subtotal = q2(Decimal(item.quantity) * item.unit_price)
      if item.subtotal != expected_subtotal:
          issues.append(
              issue(
                  "PLAN_SUBTOTAL_MISMATCH",
                  f"第 {index + 1} 条明细小计应为 {expected_subtotal}，"
                  f"方案给出 {item.subtotal}。",
                  field=f"items[{index}].subtotal",
                  retryable=True,
              )
          )
      total += expected_subtotal
  expected_total = q2(total)
```

这里用Decimal和两位小数量化，而不是直接用浮点数，避免计算中的精度问题。最终判断使用重新计算出的expected_total,而不是模型填写的plan.total_amount

### 8. 分析报告写完以后，还要再验一遍

确定性计算只解决了“第一次算的是否准确”。如果输入被错误组装、方案版本旧了，或者后续代码修改了结构化结果，仍然可能产生错误报告。

因此系统在计算之后又增加了一层独立校验器，检查：

- 分析结果是否属于当前任务
- 方案版本和方案哈希是否一致
- 分析币种是否于方案一致
- 每条明细的数量、单价和小计是否正确
- 分析中的物料集合是否与方案一致
- 分析总价是否等于明细合计
- 分析总价是否等于方案总价
- 预算差额和库存缺口是否自洽
- 供应商对比中是否包含最终选中的供应商

校验器只做检查，不顺手修改结果，这个边界很重要，如果校验器发现不对就悄悄改数字，也将造成灾难性的后果。**两层都算对了，才生成可信报告**

项目中还会吧结构化分析交给沙箱做一次独立复算。沙箱结果与本地结果不一致时，流水线采取“失败关闭”

最后，报告生成器只负责把已经计算和验证过的结构化结果变成易读文字。语言可以润色，事实不能由报告生成器重新创造。

### 9. 从“算得对”到“业务上允许”

金额正确，但并不代表采购方案就可以执行

例如：

```text
数量：1,000,000
单价：10 元
总价：10,000,000 元
```

算数上完全正确，但业务上可能完全越权，因此方案还需要第二组规则校验

项目的validate_plan 会检查：

- 方案是否属于当前任务
- 收货仓库是否与用户要求的一致
- 供应商是否来源于本次候选集
- 供应商状态是否允许交易
- 用户指定供应商被替换时，是否给出审批提示
- 方案是否遗漏需求物料
- 单价是否与真实报价一致
- 明细小计和总价是否正确
- 是否超出预算
- 交期是否已经过去或晚于要求日期
- 库存未知时是否明确标记而不是当成零缺口

错误要分类，而不是统一重试

采购校验结果不是简单的“通过”或“不通过”。系统会标记错误是否可修复，是否可重试

例如：供应商暂不可用、报价与候选数据不一致，可以重新查询并生成新方案；任务ID错误或权限不符，则不能交给模型反复碰运气。当错误可重试且次数未超限时，工作流会回到分析阶段，并携带上一轮错误作为反馈；达到上限后停止，防止模型在同一个问题上无限循环。这体现了Agent的一个重要的工程原则：**重试不是“再想一次”，而是根据明确错误类型执行一个有边界、可观察的恢复动作。**

### 10. 审批的是不是“采购这件事”，而是一版具体的方案

完成规则校验后，系统会计算方案哈希，然后进入人工审批阶段。很多系统把审批实现成：

```text
用户点击“同意”
->执行最新采购方案
```

这中间有一个危险缝隙：如果用户审批时看到的是200个，而点击确认后方案被改成了300个，执行系统仍要读取最新方案，会发生什么？

本项目中采用的方案是：**审批绑定方案版本与方案内容哈希**

方案哈希只覆盖真正影响订单的业务条款：
  
- 任务ID
- 方案版本
- 供应商
- 收货仓库
- 币种
- 物料、数量和单价
- 总价
- 预计到货日期

解释性文字、创建时间和库存快照等不进入哈希，这样，“换一种说法解释方案”不会让审批失效，但“修改数量或价格”一定会

```python
def compute_plan_hash(plan: ProcurementPlan) -> str:
    payload = json.dumps(
        canonical_plan_payload(plan),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def canonical_plan_payload(plan: ProcurementPlan) -> dict:
    """只包含业务条款，不包含解释性文字/创建时间/库存快照。"""
    return {
        "task_id": plan.task_id,
        "plan_version": plan.version,
        "supplier_id": plan.supplier_id,
        "warehouse_location": plan.warehouse_location.strip(),
        "currency": plan.currency,
        "items": sorted(
            [
                {
                    "part_id": item.part_id,
                    "quantity": item.quantity,
                    "unit_price": format(item.unit_price, ".2f"),
                }
                for item in plan.items
            ],
            key=lambda x: (x["part_id"], x["unit_price"]),
        ),
        "total_amount": format(plan.total_amount, ".2f"),
        "expected_delivery_date": (
            plan.expected_delivery_date.isoformat()
            if plan.expected_delivery_date
            else None
        ),
    }
```

发起审批时，系统会自动保存：

- approval_id
- plan_version
- plan_hash
- 方案快照
- 分析报告
- 申请人
- 审批期限
审批记录写入PostgreSQL，并用（task_id, plan_version, plan_hash）做唯一约束。

这带来两个好处：

1. 同一条审批可以被安全重放，不会产生多份相互冲突的审批记录
2. 可以准确定位“谁在什么时候批准了哪一版方案”

#### 点击确认时，还要重新证明方案没变

审批结果返回后，系统不会无条件相信前端发来的“批准”，它会重新读取当前方案，计算哈希，并与发起审批时的快照比对：

```python
current_plan = ProcurementPlan.model_validate(state["procurement_plan"])
current_hash = compute_plan_hash(current_plan)

if (
    current_hash != approval_hash
    or current_plan.version != approval_version
    or state.get("plan_version") != approval_version
    or state.get("plan_hash") != approval_hash
):
    return _failed(
        "APPROVAL_STALE",
        "审批后方案内容或版本已变化，必须重新审批。",
    )
```

项目还加入了审批角色和任务归属检查：

- 普通用户不能审批与自己无关的任务
- 管理员角色可以处理他人提交的采购任务
- 配置PROCUREMENT_REQUIRE_DISTINCT_APPROVER=true 后，申请人和审批人不能是同一人。
- 审批过期后不能继续执行
- 用户选择修改后，旧审批立即失效，必须重新分析并重新审批

## 三：订单允许执行，不等于结果已经确定

第二部分结束，系统已经拿到一份经过计算和校验、并被人工批准的采购方案，接下来看起来只差临门一脚：下单；但真正危险的也是这一步，采购订单不是一条可以随时重试的消息，它一旦写入ERP，就会产生供应商承诺，预算占用和后续履约动作，网络超时、进程崩溃、并发提交或者远端状态延迟，都可能让本地认知与ERP事实产生偏差，所以这部分我们要回答四个问题：

1. 如果请求超时，订单究竟创建没有？
2. 重复执行同一方案，怎样保证不会产生第二章订单？
3. 查到一张订单，怎样确认它和审批方案一致？
4. 服务重启后，怎样从正确的位置继续，而不是从头再来？

### 11. 把“调用一次接口”升级成订单状态机

这里把订单执行分了三个结果：成功、失败、结果未知

项目中订单执行状态定义为：

```python
class ExecutionStatus(StrEnum):
    NOT_STARTED = "not_started"
    PENDING = "pending"
    EXECUTING = "executing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    UNKNOWN = "unknown"
    NEEDS_REVIEW = "needs_review"
```

分别表示

| 状态 | 含义 | 系统应该做什么 |
| -------------- | ---------------- | ---------------- |
| `PENDING` | 已记录执行意图，尚未调用 ERP | 可以尝试抢占执行权 |
| `EXECUTING` | 当前请求已取得执行租约 | 先完成请求，其他请求不得并发创建 |
| `SUCCEEDED` | 已取得可信订单结果 | 记录订单标识并结束 |
| `FAILED` | 已确认订单没有成功创建 | 可以进入人工处理流程 |
| `UNKNOWN` | 请求可能成功，也可能失败 | 查询 ERP，禁止直接重新创建 |
| `NEEDS_REVIEW` | 已找到订单，但细节不一致 | 停止自动成功，转人工复核 |

这个状态机的核心变化是：系统不再把代码抛出异常直接等同于订单创建失败；模型和调用房看到的是业务状态，而不是一段模糊的错误文字。某个节点是否重试、是重跑创建还是查询核验由状态决定

### 12. 防重复下单：三道彼此独立的约束

只依赖一个“防重复”开关是不够的。订单链路需要多层荣誉，因为进程可能崩溃，数据库可能出现并发竞争，ERP也可能支持不完整的幂等语义

项目中采用了三道约束：

#### 第一道：稳定幂等键

同一份逻辑采购方案会生成同一个幂等键

```python
def make_idempotency_key(task_id: str, plan_version: int, plan_hash: str) -> str:
    raw = f"{task_id}:{plan_version}:{plan_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
```

它绑定了三个东西：

- 哪个采购任务
- 哪一版采购方案
- 方案中具体的业务内容

因此

- 同一任务、同一个方案重试，幂等键不变
- 用户把数量从200改成300后，方案哈希变化，形成新的幂等键
- 两笔不同任务即使商品和数量完全一样，也不会误判成同一笔订单。

另外，系统还会生成一个确定性的ERP 订单号，重试时复用它，即使远端不支持标准的幂等请求头，远端订单号的唯一约束仍能阻止大部分重复创建

#### 第二道：数据库唯一约束

执行记录表不仅把idempotency_key设为主键，还增加了一条约束

```sql
UNIQUE (task_id, plan_version, plan_hash)
```

订单号也有独立唯一索引

```sql
CREATE UNIQUE INDEX uk_procurement_execution_order_number
ON procurement_order_execution(order_number)
WHERE order_number IS NOT NULL;
```

这意味着即使应用层出现bug, 两个并发请求也无法再数据库里留下两条代表统一逻辑订单的执行记录

#### 3. 第三道：原子执行租约

幂等键解决“是不是同一笔订单”，数据库唯一约束解决“能不能写两条记录”，但还不够解决两个进程同时开始执行的问题。两个请求可能几乎同时读到PENDING，然后都以为自己应该创建订单，因此项目使用一条条件更新语句抢占执行权：

```sql
UPDATE procurement_order_execution
SET status = 'executing',
    attempt_count = attempt_count + 1,
    lease_expires_at = $1
WHERE idempotency_key = $2
  AND (
      status = 'pending'
      OR (
          status = 'executing'
          AND (lease_expires_at IS NULL OR lease_expires_at < $3)
      )
  )
```

数据库只会允许一个请求完成状态切换。另一个请求拿不到执行权，不能继续调用订单创建接口

```python
if not acquired:
    current = await self._executions.get(idempotency_key)

    if current.status == ExecutionStatus.SUCCEEDED:
        return self._succeeded_from_record(current)

    if current.status == ExecutionStatus.UNKNOWN:
        return self._unknown(
            "ORDER_RESULT_UNKNOWN",
            "之前订单结果不确定，请走 verify/reconcile 核验，不要重复创建。",
        )

    return self._unknown(
        "EXECUTION_IN_PROGRESS",
        "另一个请求正在执行订单，先查询结果，不要重复创建。",
    )
```

租约的意义不是永久锁住订单，而是处理执行进程崩溃：

- 正常情况下，执行结束会清理租约
- 如果进程在执行中崩溃，租约过期后其他实例可以接管核验
- 接管后的动作首先是查询结果，而不是重新创建订单

### 13. 超时不是失败，而是一个必须继续调查的事件

项目把不同的网关异常分开处理：

网络超时：

```python
except GatewayTimeout as exc:
    await self._executions.mark_unknown(
        idempotency_key=idempotency_key,
        code="ORDER_RESULT_UNKNOWN",
        message=str(exc),
        now=self._now(),
    )
    return self._unknown(
        "ORDER_RESULT_UNKNOWN",
        f"订单请求超时，结果未知：{exc}",
    )
```

ERP 明确返回业务拒绝：

```python
except GatewayBusinessError as exc:
    await self._executions.mark_failed(
        idempotency_key=idempotency_key,
        code=exc.code,
        message=str(exc),
        now=self._now(),
    )
```

ERP 返回“订单号已存在”时，不能简单当作失败，也不能马上重试。系统会转入对账，因为这张订单很可能已经创建

这里可以总结一条适用于所有有副作用 Agent 的规则：**工具调用超时后，Agent 不应该决定“再试一次”，而应该先判断外部系统是否已经产生了副作用。**

### 14. 查到订单不等于可以直接宣布成功

订单核验应分为两个方面：

1. ERP里有没有这张订单？
2. 这张订单的内容是不是我们批准的那一版？

只核验第一点很容易产生假成功，例如，系统按订单号查到了一张订单，但里面的数量、价格或供应商被修改，仍然不代表订单正确。项目中的valiadate_remote_order会逐项比较：

- 订单号是否与本地确定性订单号一致
- 每个计划物料是否都出现在远端订单中
- 数量是否一致
- 单价是否一致
- 小计是否等于数量✖️单价
- 总金额是否与审批方案一致
- 供应商是否与审批方案一致

如果数量或价格不一致，系统不会把记录改成成功，而是进入NEEDS_REVIEW

```text
订单已找到->内容与审批方案不一致->停止自动完成->等待人工复核
```

这个状态设计很重要，它不是普通的失败，因为订单可能真的存在，也不是成功，因为内容不一致，把它强行塞进成功或失败都会丢失关键事实

#### 一次查不到也不能立刻判定没创建

ERP的主从同步和最终以执行可能导致刚创建的订单短时间内查不到，因此“确认未创建”需要满足最小核验次数和时间窗口：

```text
第一次查不到 → UNKNOWN，继续核验
第二次查不到 → UNKNOWN，等待时间窗口
达到确认次数和最小时间 → NOT_CREATED
```

这样做牺牲了一些收敛速度，换取到的是更低的误判概率。

#### 核验只读，并且能够无人运行

核验器有一个必须遵守的边界：**核验模块永远不调用创建订单接口。**它的职责是查证事实，不是修复订单，否则对账可能变成另一个重复下单的入口。

除了用户主动恢复任务，项目还启动了后台对账Worker,周期性扫描UNKNOWN和租约已过期的EXECUTING记录。这意味着：

- 用户关掉页面后，未知订单仍会继续核验
- 执行进程崩溃后，不会永远停在EXECUTING
- 多实例Worker通过核验租约避免重复处理
- 无法自动判断时，保留UNKNOWN或进入人工复核，而不是猜一个结论。

#### 当前实现的一个边界

在当前项目中，超时后的未知订单会走完整的内容对账；正常同步返回的创建结果则以ERP返回的订单数据和执行记录为主。对一般订单，这已经能确认创建结果；但对于大额或高风险采购，还可以进一步要求：所有创建成功相应都强制在执行一次只读查询和内容对比。

这也是“可靠系统”与“声称绝对可靠”之间的区别：工程上不应该隐藏边界。发现边界，再为它增加策略和证据，本身就是可靠性建设的一部分。

### 15. 服务重启后，恢复的是任务，而不是一段聊天

Checkpoint能保存LangGraph执行到哪一步，但一笔采购任务还需要回答：

- 它属于哪个用户？
- 它当前是什么业务状态？
- 对应的线程是哪一条？
- 失败后应该从哪里恢复？
- Checkpoint丢失后如何处理？

因此项目还会同时保存两类信息

| 存储 | 保存什么 | 解决的问题 |
| -------------------- | ---------------- | ------------- |
| LangGraph Checkpoint | 图状态、当前节点、中断信息 | 工作流从哪里继续 |
| 业务数据库 | 任务归属、审批记录、订单执行事实 | 任务属于谁、业务结果是什么 |

任务启动时生成稳定的task_id，并应设为固定的线程标识：

```python
def task_thread_id(task_id: str) -> str:
    return f"procurement:{task_id}"
```

服务重启后，恢复请求会使用这个线程标识读取原Checkpoint，而不是创建一条新流程。

恢复入口还会重新校验用户和角色：

```python
is_owner = record.user_id == user_id
is_approver = bool(set(roles) & {"approver", "admin"})
```

即使知道task_id, 没有权限的用户也不能恢复或审批改任务。

恢复逻辑还区分几种状态“

- 有待处理中断：通过Command(resume=...)回到被中断的节点
- Checkpoint存在但已结束：幂等返回结果，不再执行
- Checkpoint丢失：把任务标记成OROHANED,不假装可以恢复
- 订单结果未知：回到核验流程，不回到订单创建流程。

测试中的典型场景是：审批弹窗出现后服务重启，新 Runner 使用原 Checkpoint 恢复，最终只创建一张订单。

这里可以把 Checkpoint 和业务数据库的关系总结为：**Checkpoint 负责让流程接着跑，业务数据库负责告诉我们跑到了哪、能不能跑、以及外部世界到底发生了什么。**，两者不能相互替代

### 16. 用失败场景证明系统真的会拦截

一个采购 Agent 可能成功创建一次订单，却在缺少仓库时默认选仓、在报价缺失时编造价格、在审批被修改后执行旧方案，或者在重复提交时创建两张订单。这些错误不会出现在“Happy Path”演示里。

因此项目中建立了30个业务场景，分为6组：

| 分组 | 验证内容 |
| ------------- | --------------------- |
| `requirement` | 缺字段追问、多物料、修改后新版本 |
| `tool` | 物料不存在、供应商停用、上游超时 |
| `analysis` | 总价、库存缺口、报价缺失、交期未知 |
| `approval` | 未审批不下单、拒绝、修改、越权 |
| `recovery` | 重启恢复、超时核验、重复提交 |
| `report` | 报告数字一致、数据来源、失败不生成成功结论 |

它们不仅验证最终文本，还检查：

- 是否在错误的阶段创建了订单。
- 创建订单的次数有没有超过上限
- 工作流最终停在哪个状态
- 返回了哪个错误码
- 工具调用次数是否失控
- 报告是否包含必要事实
- 分析失败时有没有错误地生成报告

但这组数字不能直接等同于“生产零错误”，报告中的 P95 为 33 ms，来自使用测试替身和内存 Checkpoint 的评测环境，不能代表真实 ERP 网络的延迟。30 个场景全部通过，说明当前状态机和规则在已定义的故障模型下符合预期，不等于覆盖了生产中的所有异常。

上线前还需要面对：

- 真实 ERP 的语义和最终一致性差异。
- 真实身份认证、审批权限和组织架构。
- 网络长尾延迟与大面积服务故障。
- 大额采购的双人审批和额度策略。
- 对账未收敛订单的告警和 SLA。
- 数据新鲜度、供应商报价变更和价格有效期。

### 17. 结语：AI 采购助手的防错，是一套系统工程

回到开头那个场景。

ERP 已经创建订单，却返回超时。一个只关注“工具调用是否成功”的 AI 助手，可能会再调用一次；一个真正面向业务的系统，会先停下来判断：

```text
这个请求是否已经执行过？
有没有稳定的幂等键？
远端是否已经产生了订单？
本地是否记录了执行事实？
应该重新创建，还是只读核验？
核验发现内容不一致时，谁来处理？
```

这套判断最终落在七层防线中：

1. **输入防线**：缺失信息先追问，不猜业务字段。
2. **事实防线**：只使用真实查询到的物料、库存、报价和供应商。
3. **计算防线**：金额和库存缺口由确定性代码计算并独立复核。
4. **规则防线**：供应商状态、仓库、预算、交期和数量必须通过业务校验。
5. **审批防线**：审批绑定具体方案版本和内容哈希，方案变化即失效。
6. **执行防线**：用幂等键、唯一约束、执行租约和 `UNKNOWN` 状态防止重复下单。
7. **核验防线**：只读对账、逐项比对订单内容，用恢复和评测机制证明异常可处理。

对任何有副作用的 Agent 应用，这套思路都可以迁移：

> 模型可以理解目标、提出方案、解释选择；  
> 确定性代码负责事实、规则和边界；  
> 状态机负责表达不确定性；  
> 业务数据库负责保存事实；  
> 自动化测试负责证明系统在错误条件下仍然知道该做什么。

所以，“AI 采购助手如何确保下单不出错”的真正答案，不是让模型永远不犯错。

而是让系统的关键链路满足三个条件：

**错误发生前拦得住，结果不确定时停得下，异常发生后查得清、恢复得了。**

当 AI 从“回答问题”进入“改变现实世界”时，这才是 Agent 工程真正开始的地方。
