# Video workflow harness

Harness này chia pipeline thành hai loại việc để coding agent chỉ dùng token cho phần cần phán đoán.

## Luồng chuẩn

```text
request
  → script/cues agent
  → TTS dry-run (runner, miễn phí — bắt speaker/delivery sai)
  → người dùng duyệt lời
  → voice + timing (runner)
  → scenes agent
  → build + verify + stills (runner)
  → visual QA (phiên riêng, chỉ đọc)
  → xử lý feedback còn mở
  → người dùng duyệt scenes
  → render + transcript (runner)
  → deliver agent
  → final build + verify (runner)
```

Coding agent chỉ viết hoặc sửa deliverable của stage. Build, verify, screenshot, render, transcript,
đo media và tổng hợp telemetry thuộc runner. Vì vậy một lỗi deterministic không tiêu thêm một lượt
agent chỉ để chạy lại cùng một lệnh.

## Cổng và khả năng resume

- Mỗi job ghi event `started → metrics → finished` vào `projects/<id>/.studio/runs.jsonl`.
- Event append-only giúp giữ được lần chạy lỗi và nhận ra run còn dang dở sau khi process chết.
- Stage chỉ chuyển sang `review` khi agent và deterministic gate đều chạy xong.
- Cues chỉ sang `review` sau `tts.mjs generate --dry-run` (không truyền key, không tốn credit): nó ép
  mọi `speaker` qua danh mục `voices.json`, chặn `delivery` lạ và báo nhân vật thiếu avatar.
- Ảnh QA do gate chụp nằm ở `projects/<id>/qa/auto/`; gate chỉ dọn thư mục đó, ảnh người làm tự chụp
  trong `qa/` không bị đụng.
- Scene QA là một **phiên riêng, context sạch, chỉ đọc** — giá trị nằm ở đó, không ở tên nhà cung cấp.
  Lane chỉ nhận một packet tạm ngoài repo (để CLI không tự nạp `CLAUDE.md`/`AGENTS.md`): request,
  kịch bản gốc, `cues.js` (lời + mô tả màn hình từng câu — căn cứ để xét `off-script`), improvement plan,
  output verify và ảnh still.
- **Review chéo là công tắc của từng video** (`state.review = { enabled, provider }`), bật sẵn, đổi được
  bất cứ lúc nào ở form Kế hoạch hoặc bước Dựng cảnh — khác agent dựng cảnh, vốn bị khoá khi tạo video.
  `provider: auto` chọn CLI đã cài **khác** agent đang dựng (Antigravity → Codex → Claude); máy chỉ có một
  CLI thì CLI đó tự review trong phiên riêng. Chọn đích danh thì CLI đó phải đã cài. `STUDIO_REVIEW` và
  `STUDIO_QA_PROVIDER` chỉ là mặc định cho video mới.
- Tắt review: runner vẫn build, verify, chụp ảnh; finding QA cũ còn hiện nhưng **không chặn duyệt**.
- "Chạy lại review" (`POST /api/videos/<id>/review {action:"run"}`) chạy gate + review trên cảnh hiện
  có mà không gọi agent — sau khi bật review, đổi người review hoặc tự sửa tay một cảnh.

  | Provider | Chỉ đọc bằng | Schema |
  |---|---|---|
  | Claude | `--tools Read Glob Grep`, cấm Write/Edit/Bash | `--json-schema` |
  | Codex | `--sandbox read-only`, ảnh đính kèm bằng `--image` | `--output-schema` |
  | Antigravity | `--mode plan --sandbox` | `--json-schema` |

- Tiêu chí QA = tiêu chí chung + mục `## Tiêu chí QA` của đúng những module đang bật
  (`templates/modules/<id>.md`). Video không bật module nào thì QA không thấy tiêu chí của module đó.
- QA có finding `blocker` hoặc `major` thì API không cho duyệt scene.
- Deliver chỉ `done` sau final build + verify.
- Các command tạo artifact dùng đường dẫn cố định; chạy lại thay artifact của chính stage, không tạo
  bản sao khó truy nguồn.

## Hiện trên Studio

Mọi bước dùng chung một khuôn: **kết quả** của bước ở trên cùng, **việc cần làm** chỉ hiện khi có việc,
**chi tiết** (cài đặt nâng cao, nhật ký, tóm tắt agent) gập lại, và một **thanh quyết định dính đáy** gồm
trạng thái, hành động chính của bước, Quay lại / Tiếp. Tiếp chỉ hiện khi bước đã xong; trước đó hành động
của bước (Duyệt, Tạo giọng, Render…) là nút chính duy nhất.

Mỗi bước có agent (Lời & cue, Dựng cảnh, Bàn giao) có panel **Kiểm tra tự động**:

- Các chặng của lượt gần nhất — `Agent → TTS dry-run`, `Agent → Build → Verify → Chụp ảnh → Review chéo`,
  `Agent → Build → Verify`. Lượt xong sạch gập thành **một dòng**; chỉ khi đang chạy hoặc có chặng lỗi mới
  bung ra từng ô (trạng thái, thời gian, chi tiết). Runner ghi từng bước vào
  `projects/<id>/.studio/harness/<stage>.json` và báo trang qua SSE, nên trang thấy ngay chặng đang chạy và
  tải lại vẫn thấy lượt trước kết thúc thế nào.
- Kết luận review (Đạt / Cần sửa, người review) hiện hai dòng, "Đọc toàn bộ" mới bung. Khi bước đã duyệt,
  kết luận chỉ còn một dòng lịch sử. Người review và công tắc review chéo nằm ở nút ⚙ trên đầu panel, cạnh
  "Chạy lại review".
- Finding lấy từ ledger, nhóm như nút Duyệt nhìn: **Cần xử lý** (blocker/major, ảnh cảnh lớn), **Lưu ý**
  (minor, không chặn), **Đã bỏ qua**, **Đã hết ở lượt review này** (`resolvedBy` = run review đó). Mỗi
  finding có ảnh cảnh, mã lỗi tiếng Việt, số lần lặp.
- Nút Duyệt tự khoá và nói còn bao nhiêu lỗi chặn — cùng một luật với API (`blockersFor`).
- **Chọn sửa / bỏ qua** (`POST /api/videos/<id>/findings`): mỗi lỗi blocker/major có `Sửa | Bỏ qua`.
  Sửa là mặc định; Bỏ qua bắt buộc lý do (*Cố ý thiết kế* · *Review đánh giá sai* · *Để sau* · tự ghi).
  Lỗi minor có ô **Sửa luôn** (mặc định không tick) để đi cùng lượt sửa. Khung **Gửi cho agent** là đường
  duy nhất nói với agent dựng cảnh: lỗi đã chọn hiện thành chip, cộng ghi chú tự do; không chọn lỗi nào thì
  ghi chú đi như một Góp ý. Nút gửi nằm trên thanh quyết định. Lỗi chọn Sửa thành `planned` → `applied`,
  review ngay sau đó xác nhận hoặc mở lại; lỗi bỏ qua thành `wontfix` kèm `skipReason`, `decidedAt`, **không
  bị review lượt sau mở lại** — chỉ tăng `recurrence` — và có nút **Mở lại**. Từ CLI:
  `feedback set --status wontfix --reason "…"`.
- **Xem tất cả cảnh** gập sẵn — review chéo đã xem hết rồi, lưới ảnh là cho lúc người dùng muốn tự xem. Ảnh
  chính của mỗi cảnh là `qa/auto/cue-NN.png` (đúng ảnh reviewer chấm); ảnh agent tự chụp (`sNN.png`,
  `sNN-fNNN.png`) là ảnh phụ của cảnh đó, xem trong lightbox. Lọc **Tất cả / Có lỗi**, chấm màu theo lỗi
  nặng nhất còn mở của cảnh.
- "Chi phí & lượt chạy" nằm trong mục **Thông số** gập lại ở panel xem trước bên phải.

## Telemetry

Mỗi run có: `runId`, stage, actor, mode (`agent|deterministic`), thời gian, status, checks, artifacts,
tool calls, input/cached/output tokens và cost khi provider có trả usage. Số chưa được provider trả về
được giữ là “chưa đo”, không tự ghi bằng 0.

Xem báo cáo:

```bash
npm run workflow -- report --video <id>
npm run workflow -- report --video <id> --json
```

Báo cáo nêu automation ratio, số lượt agent/deterministic, failure count, token/cost, coverage của
usage và stage tốn token nhất. Dashboard Video Studio hiển thị cùng số liệu.

## Feedback không bị trôi

Feedback là event có `id`, fingerprint, source, stage, severity, owner, acceptance check, recurrence
và status:

```text
open → planned → applied → verified
                         ↘ wontfix
```

Feedback trùng fingerprint được tăng `recurrence` thay vì tạo item mới. Finding QA có `code` cố định
(`text-overflow`, `overlap`, `unreadable`, `low-contrast`, `empty-layout`, `clipped`, `misaligned`,
`repetitive`, `off-script`, `module`, `other`) và fingerprint là `stage + cảnh + code` — câu `message`
do model viết chỉ để người đọc, vì model không bao giờ viết lại y hệt một câu ở hai lượt. Feedback của
người dùng không có code nên vẫn nhận dạng theo câu chữ. Mỗi thay đổi tự viết lại
`projects/<id>/.studio/IMPROVEMENT-PLAN.md`, ưu tiên blocker → major → minor. Agent retry luôn nhận
toàn bộ item còn mở của đúng stage. QA tự xác nhận finding cũ khi lượt sau không còn cùng `cảnh + code`; feedback của người dùng chỉ `verified` khi người dùng duyệt stage.

CLI:

```bash
npm run workflow -- feedback add --video <id> --stage scenes --severity major --message "..."
npm run workflow -- feedback list --video <id>
npm run workflow -- feedback set --video <id> --id <fb-id> --status verified --evidence "..."
npm run workflow -- plan --video <id>
```

## Cách tối ưu dần

Sau mỗi video, đọc report theo thứ tự:

1. Stage có `agentTokens` cao nhất: rút gọn prompt/context hoặc chuyển check lặp lại sang runner.
2. Feedback có `recurrence > 1`: biến acceptance check thành static check hoặc visual rubric.
3. Deterministic run lỗi lặp lại: sửa gate hoặc preflight; không thêm lời nhắc dài cho agent.
4. `measuredRuns < agent runs`: sửa parser usage của provider trước khi so chi phí.
5. Chỉ thêm agent lane khi đầu ra cần phán đoán độc lập. QA thị giác là một phiên riêng chỉ đọc; build,
   verify, capture và media validation vẫn là runner.

Không dùng automation ratio làm mục tiêu tuyệt đối. Một lượt agent có chất lượng tốt hơn nhiều retry
vẫn rẻ hơn pipeline “tự động” nhưng liên tục trả feedback.
