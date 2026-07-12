# PLAN：写卡实施步骤

配套 [spec-写卡.md](./spec-写卡.md)。三步，每步跑得起来、验得了。

跟抽卡不一样的地方：**DeepSeek 便宜**（几分钱一张卡），不需要 `dry_run` 那种「怕扣费」的设计。但**拼错 system prompt 是免费犯错、代价延后**——错的上下文会稳定产出格式跑偏的 md，人得抽了卡才发现。所以这一版的验证重心在**第 1 步的纯函数单测**：不调 API，先断言喂出去的东西是对的。

---

## 第 1 步：Rust，先把「喂什么」验对

不碰界面。

1. Cargo 加 `futures-util`，`reqwest` 补 `stream` feature。
2. `project.rs` 补几个纯文件操作：
   - `read_env_key(root, name)` / `write_env_key(root, name, value)`——把现有 `read_api_key` / `write_api_key` 里写死的 `APIMART_API_KEY` 抽出来，两个 key 复用同一套 `.env` 读写。现有命令改成薄包装，**行为不变**。
   - `read_context(root)` / `write_context(root, kind, content)`——读写 `ip.md` / `AGENTS.md`。
   - `load_examples(root, category, limit)`——取同类目的 md 当范例，剥掉指令行；**不够 2 个就从别的类目补**（spec 里的硬伤兜底）。
   - `create_prompt(root, category, name, raw)`——校验名字（非空、没有 `/` `\` `..`）、建目录、**撞名直接 Err**。
   - `Project` 加 `has_deepseek_key`。
3. `deepseek.rs`：
   - `build_messages(ip, agents, examples, category, name, intent) -> Vec<Value>`——**纯函数，这是这一步的重点。**
   - `stream_chat(client, key, model, messages, on_delta) -> Result<String>`——SSE 解析。
   - `strip_fences(text)`——模型套了 ``` 围栏就剥掉。
4. `mod.rs` 挂 4 个命令，`generate_prompt` 里 emit `deepseek://delta`。

### 这一步的坑

**SSE 缓冲区必须是 `Vec<u8>`，不能是 `String`。** HTTP chunk 会从任意字节切开，一个中文字 3 个字节，按 `String::from_utf8_lossy(&chunk)` 逐块拼会把切在边界上的汉字拼成 `�`。做法：字节缓冲，按 `b'\n'` 切出完整行，**对完整的行**才做 utf8 解码。

`data: [DONE]` 要跳过，解析不了的行直接忽略（DeepSeek 会发心跳注释行）。

### 验收

`build_messages` 的单测，断言 system prompt 里：

- 含 `ip.md` 全文、含 `AGENTS.md` 全文（逐字，不是摘要）
- 含范例的【1. 身份锁定】原文，**且含「不要复制参考图的背景和排版」那句**
- 空类目时范例来自别的类目（不是空的）
- 不含 `<!-- size:` ——指令行不该进模型（约定 7）

`create_prompt` 的单测：撞名回 Err 且**原文件字节不变**；名字带 `../` 回 Err。

然后真跑一次 `generate_prompt`（几分钱），把结果打出来，人眼过一遍四段结构在不在。

---

## 第 2 步：角色页 + 策略页 + 设置

界面里最简单的一块，先做，做完就能编辑上下文了。

1. `stores/context.ts`：ip / agents 内容、load / save。
2. `components/context-editor.vue`：路径行 + 一句人话 + 大 textarea + 保存。角色页和策略页各传一个 `kind`。
3. `views/character/index.vue`、`views/strategy/index.vue`——两个薄壳。
4. `menu-data.ts` 加三栏（写卡 / 角色 / 策略），写卡先占位。
5. 设置页补 DeepSeek key 一节 + 模型下拉（存 pinia）。

**验收**：角色页出 `ip.md` 全文，改一个字保存，`git diff` 只动那一个字（**别在存盘时顺手 trim 或加尾换行**——那会让 diff 里多出无关的行）。设置里存 DeepSeek key，`.env` 里出现第二行，`APIMART_API_KEY` 那行没被动过。

---

## 第 3 步：写卡页

1. `stores/writer.ts`：类目、名字、画幅、意图、草稿、思维链、生成中状态；`generate()` 监听 `deepseek://delta` 往 `draft` 上追加；`saveAndGo()` 调 `create_prompt` → `gacha.scanProject()` → `gacha.selectPrompt()` → `router.push('/gacha')`。
2. `views/writer/index.vue`：两栏（复用 `resizable`）。
   - 选类目 → 自动切画幅（表情 `1:1`，其他 `16:9`）
   - 名字自动建议下一个编号（扫 `store.project` 里同类目的 `NN-` 前缀最大值 +1）
   - 存盘前把指令行拼到正文最前面——**跟抽卡页 `prompt-editor.vue` 里的 `syncDirectives()` 是同一件事，抽出来共用，别抄第二份。**
3. 思维链折叠区，`deepseek-chat` 下不渲染。

**验收**：走 spec 里那七条。第 3 条（字一个一个流出来）和第 7 条（`draw.py --dry-run` 认这个 md）是重点——前者验流式没写死，后者验产出和手写的同构。

---

## 收尾

`~/Desktop/角色抽卡/AGENTS.md` 补一句：现在提示词可以在 app 里让 DeepSeek 写，规范不变，**这份文件本身就是喂给它的 system prompt**——改这份文件等于改模型的行为。

这句话得写进去。不然下次有人来改 AGENTS.md，不会知道自己在改的是什么。

## 不在这一版里

- **让 DeepSeek 改写已有的 md**。抽卡页的编辑器已经能手改，先用一阵，看看到底是「从零写」需求多还是「改一版」需求多。
- **看图改词**。要多模态模型，是另一个设计。
- **多轮对话**。第一版是「一句意图 → 一张卡」，不是聊天。真不够用了再说。
