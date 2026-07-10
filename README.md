# 授权升级中心 · 接入文档

供被授权程序（如 XZJI）接入本中心的 API 契约。所有接口均为 JSON over HTTP，前缀 `/api/v1`，无需登录态。

## 服务端数据库

服务端数据库统一使用 PostgreSQL。首次启动时会根据 `backend/config.yaml` 自动创建目标数据库并执行表结构迁移；生产环境也可以提前建库并将 `database.auto_create` 设为 `false`。

## 接入前提

在管理后台「产品管理」创建产品后获得：

- **产品标识**（slug，如 `xzji`）：调用 API 时携带；
- **产品公钥**（Ed25519，base64）：**必须硬编码嵌入接入方程序**，用于验证授权响应签名，防止假授权服务器伪造响应。

客户从你处获得**授权码**（形如 `XXXXX-XXXXX-XXXXX-XXXXX`）。

## 一、激活

```
POST /api/v1/activate
{ "product": "xzji", "code": "ABCDE-FGHJK-LMNPQ-RSTUV", "domain": "example.com", "version": "1.0.0" }
```

- 首次激活：绑定域名，有效期**从激活时起算**（年度 365 天 / 永久 / 自定义天数）。
- 同域名重复激活：幂等，返回当前状态（适用于重装）。
- 已绑定其他域名：返回 `status: "domain_mismatch"`。
- 授权码/产品不存在：HTTP 404 + `{"error": "..."}`。

成功响应（激活/心跳同构，均为**签名状态响应**）：

```json
{
  "product": "xzji",
  "code": "ABCDE-FGHJK-LMNPQ-RSTUV",
  "domain": "example.com",
  "status": "active",
  "expires_at": 1782000000,
  "timestamp": 1751500000,
  "latest_version": "1.2.0",
  "sha256": "更新包哈希（无已发布版本时为空）",
  "heartbeat_interval_hours": 6,
  "grace_period_days": 7,
  "signature": "base64 Ed25519 签名",
  "update": { "version": "1.2.0", "changelog": "...", "file_size": 12345678, "sha256": "...", "forced": false },
  "message": "激活成功"
}
```

字段说明：

- `status`：`active` / `expired` / `revoked` / `unactivated` / `domain_mismatch`；
- `expires_at`：unix 秒，`0` 表示永久；
- `update`：仅当存在比请求中 `version` 更新的已发布版本时返回，**接入方展示新版本提示时用它**；
- `heartbeat_interval_hours` / `grace_period_days`：客户端应按此间隔心跳、按此宽限期容错。

## 二、验签（安全关键，必须实现）

签名覆盖以下字段，按顺序用 `\n` 拼接后以产品私钥 Ed25519 签名：

```
product \n code \n domain \n status \n expires_at \n timestamp \n latest_version \n sha256 \n heartbeat_interval_hours \n grace_period_days
```

其中数字均为十进制字符串。Go 验签示例：

```go
import (
    "crypto/ed25519"
    "encoding/base64"
    "fmt"
    "strings"
)

// publicKeyB64 为硬编码在程序内的产品公钥
func VerifyStatus(publicKeyB64 string, r StatusResponse) bool {
    msg := strings.Join([]string{
        r.Product, r.Code, r.Domain, r.Status,
        fmt.Sprintf("%d", r.ExpiresAt),
        fmt.Sprintf("%d", r.Timestamp),
        r.LatestVersion, r.SHA256,
        fmt.Sprintf("%d", r.HeartbeatIntervalHours),
        fmt.Sprintf("%d", r.GracePeriodDays),
    }, "\n")
    pub, _ := base64.StdEncoding.DecodeString(publicKeyB64)
    sig, _ := base64.StdEncoding.DecodeString(r.Signature)
    return ed25519.Verify(ed25519.PublicKey(pub), []byte(msg), sig)
}
```

**客户端强制规则**：

1. 验签失败 → 视为无效响应，按断网处理（进入宽限期），绝不采信；
2. `timestamp` 与本地时间偏差超过 10 分钟 → 拒绝（防重放旧的有效响应）；
3. 验签通过且 `status != active` → 按到期/吊销处理（停止对外服务）；
4. 心跳成功后将**整个响应**缓存到本地；服务器不可达时凭缓存运行，缓存的 `timestamp` 距今超过 `grace_period_days` 天 → 停止对外服务。

## 三、心跳

```
POST /api/v1/heartbeat
{ "product": "xzji", "code": "...", "domain": "example.com", "version": "1.0.0" }
```

- 建议按响应中的 `heartbeat_interval_hours` 定时调用（也应在程序启动时调用一次）；
- 响应结构与激活相同（签名状态响应）；
- 服务端会记录心跳时间/版本/IP，用于后台「活跃站点」统计。

## 四、升级下载

**第 1 步**：请求下载令牌（授权必须在有效期内，域名必须匹配）：

```
POST /api/v1/upgrade/request
{ "product": "xzji", "code": "...", "domain": "example.com" }
```

响应：

```json
{
  "url": "/api/v1/download/<token>",
  "version": "1.2.0",
  "changelog": "...",
  "file_size": 12345678,
  "sha256": "...",
  "forced": false,
  "expires_at": 1751500900
}
```

**第 2 步**：`GET <中心地址>/api/v1/download/<token>` 下载全量更新包。令牌**一次性**、15 分钟内有效。

**第 3 步**：客户端校验文件 SHA256 与响应中 `sha256` 一致（同时应与心跳签名响应中的 `sha256` 一致）后，再执行备份→替换→重启。**哈希不一致必须丢弃文件**（防升级通道劫持）。

## 五、限流

按 IP 限流：激活 10 次/分、心跳 60 次/分、升级请求 10 次/分、下载 20 次/分、后台登录 10 次/分。收到 HTTP 429 应退避重试。

## 六、推荐的客户端状态机

```
启动 → 读本地缓存凭证
  ├─ 无凭证 → 要求输入授权码 → activate
  ├─ 有凭证（验签通过、未超宽限期）→ 正常运行，定时 heartbeat
  │     ├─ heartbeat 成功 status=active → 刷新缓存
  │     ├─ heartbeat 成功 status=expired/revoked/domain_mismatch → 停止对外服务
  │     └─ heartbeat 失败（网络）→ 继续用缓存，超宽限期后停止对外服务
  └─ 凭证无效/超宽限期 → 停止对外服务（管理后台仍可访问，可重新输码）
```

「停止对外服务」的约定：前台所有页面显示「授权已过期，请联系服务商」，程序管理后台保持可登录，以便查看授权状态与重新激活。
