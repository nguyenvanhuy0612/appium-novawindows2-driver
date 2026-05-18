# Escape-character & input-path review

**Status: updated 2026-05-18 sau khi chạy E2E test thực tế trên Notepad.**

Investigating `{RETURN}` not firing in `SecureAge Password Form` (B1 regression).

Test file: `tests/e2e/stable/escape-and-return.e2e.spec.ts`.

---

## TL;DR sau khi test

| Finding cũ | Sau khi test | Trạng thái |
|---|---|---|
| F1 — thiếu escape `{ } [ ]` | **Chỉ `{ }`** gây crash, `[ ]` thực ra OK | 🔴 BUG XÁC NHẬN (narrow) |
| F2 — split SendKeys+SendInput race | `{RETURN}` qua `setValue` work đúng trên Notepad | ❌ KHÔNG REPRO trên Notepad (cần test SecureAge) |
| Bug mới: `windows: getClipboard` flatten multi-line | Phát hiện qua test harness | 🔴 BUG MỚI XÁC NHẬN |

---

## 0. Trace end-to-end của `Appium Input ${pw}{RETURN}`

1. **Robot** (`base_swin.resource:405`): `Appium Input ${passwd_loc} ${profile_passwd}{RETURN}` — Robot truyền literal `"<password>{RETURN}"` xuống Python.

2. **AppiumLibrary** `_format_keys` (`_element.py:1839`):
   - Regex `\{(\w+)(?: (\d+))?\}` → `{RETURN}` → `Keys.RETURN` = ``.
   - Text trở thành `"<password>"`.

3. **Selenium WebDriver** POST `/element/{id}/value` body `{"text":"<password>"}`.

4. **Driver** (`element.ts:195` `setValue`):
   - Iterate codepoints.
   - ASCII (< 0xE000): push vào `keysToSend[]` sau khi escape `+ ^ % ~ ( )`.
   - `` (≥ 0xE000): flush `keysToSend` qua `[Windows.Forms.SendKeys]::SendWait` (PS subprocess), rồi dispatch keyDown+keyUp qua `handleKeyActionSequence` → `keyDown(char)` từ Node (`winapi/user32.ts` SendInput).

5. **`` → VK_RETURN** ở `user32.ts:499`.

⇒ Hai process khác nhau (PS subprocess gõ ASCII, Node gõ VK_RETURN) đụng input queue.

---

## 1. F1 — Missing escape for `{` `}` (CONFIRMED)

### Code (`element.ts:302`)

```typescript
keysToSend.push(char.replace(/[+^%~()]/g, '{$&}'));
```

### Test kết quả

E2E suite `escape-and-return.e2e.spec.ts` chạy trên Notepad local (driver 1.1.19 = HEAD):

| Input | Test result | PS error |
|---|---|---|
| `A{B` | ❌ FAIL | `Keyword delimiter is missing.` |
| `A}B` | ❌ FAIL | `SendKeys string 'A}B' is not valid.` |
| `{value}` | ❌ FAIL | `Keyword "value" is not valid.` |
| `P@ss{w0rd}` | ❌ FAIL | `Keyword "w0rd" is not valid.` |
| `P{ass}word` | ❌ FAIL | `Keyword "ass" is not valid.` |
| `A[B` | ✅ pass (sau khi loại pollution) | — |
| `A]B` | ✅ pass | — |
| `[abc]` | ✅ pass | — |
| `sec[ret]` | ✅ pass (sau pollution) | — |
| `A+B`, `A~B`, `A^B`, `A%B`, `A(B)C` | ✅ pass | regex đã escape đúng |

**Kết luận F1**: chỉ thiếu escape `{` và `}`. `[ ]` thực ra Microsoft SendKeys grammar không treat là metachar — passed through literal.

### Tác động

Bất kỳ chuỗi text/password chứa `{` hoặc `}` đi qua `setValue` → driver **throw `WebDriverError: Exception calling "SendWait" ... ArgumentException`** từ `[Windows.Forms.SendKeys]::SendWait`. Test sẽ fail với error obvious, không phải fail im lặng.

### Fix tối thiểu (chưa apply)

```typescript
keysToSend.push(char.replace(/[+^%~(){}]/g, '{$&}'));
```

Một dòng, một regex character class mở rộng. Theo Microsoft docs SendKeys, `{{}` là literal `{` và `{}}` là literal `}`. Thay `$&` (the matched char) bằng `{$&}` đúng cú pháp này.

---

## 2. F2 — `{RETURN}` split SendKeys+SendInput (NOT REPRODUCED trên Notepad)

Hypothesis ban đầu: `setValue("text")` flush "text" qua SendKeys.SendWait từ PS subprocess, rồi `SendInput(VK_RETURN)` từ Node — 2 process race nhau, có thể làm Enter trôi.

### Test kết quả (Notepad)

| Test | Result | Behaviour |
|---|---|---|
| `hello` via setValue | ✅ pass | Notepad có `hello\r\n` |
| `line1line2` via setValue | ✅ pass | `line1\r\nline2` |
| `abc` (3 RETURN inline) | ✅ pass | 3 lines |
| `` alone | ✅ pass | newline |
| `` (ENTER) | ✅ pass | newline |
| `secret123` (SecureAge-style) | ✅ pass | `secret123\r\n` |

→ **F2 không phải bug trên Notepad.** Split SendKeys/SendInput có race về lý thuyết nhưng Notepad nhận Enter đúng. Có thể vẫn lộ trên app slow-UIA (SecureAge) — chưa verify.

---

## 3. 🆕 Bug mới: `windows: getClipboard` flatten multi-line text

Phát hiện trong lúc viết test harness:

### Code (`extension.ts:85`)

```ps1
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Clipboard)))
```

### Vấn đề

`Get-Clipboard` (không có `-Raw`) return `string[]` — mảng từng dòng. PS implicit array→string conversion dùng `$OFS` (default = space) → multi-line text bị nối bằng space.

### Repro

- Clipboard chứa `line1\r\nline2`.
- `windows: getClipboard` trả về base64 của `"line1 line2"` (space, không phải newline).
- Verify: dùng `Get-Clipboard -Raw` cho kết quả đúng `line1\r\nline2`.

### Tác động

Bất kỳ test/keyword nào dùng `windows: getClipboard` để verify nội dung multi-line đều nhận data sai. Cảm giác như VK_RETURN không work nhưng thực ra clipboard reader mới sai.

### Fix tối thiểu (chưa apply)

```ps1
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Clipboard -Raw)))
```

---

## 4. Các path interpolation user-input vào PS (không đổi từ review trước)

| Vị trí | User input | Escape | An toàn? |
|---|---|---|---|
| `element.ts:241` SendKeys payload | text | `PSString` (unicode hex) + regex escape SendKeys metachars | PS layer SAFE; **SendKeys layer thiếu `{ }`** (F1) |
| `element.ts:227` ValuePattern.SetValue | text | `PSString` | SAFE |
| `elements.ts:294,304,317,337` GET_ELEMENT_*_PROPERTY templates | propertyName / patternName | RAW interpolation | Rủi ro nếu propName user-controlled (low) |
| `app.ts:149,174` Start-Process path / args | path / appArguments | `.replace(/'/g, "''")` | SAFE |
| `app.ts:181` `Get-Process -Name` processName | derived from path | RAW | Edge case: file path có quote (hiếm) |
| `powershell.ts:678` `Set-Location -Path` | appWorkingDir | `.replace(/'/g, "''")` | SAFE |
| `file.ts:16,32,46` `$targetPath` | remotePath | `.replace(/'/g, "''")` | SAFE |
| `file.ts:17` `$base64String` | base64Data | regex pre-validated | SAFE |
| `common.ts:12` `PSString` | bất kỳ string | unicode hex escape | SAFE |
| `extension.ts:85` `Get-Clipboard` | — | — | **BUG: thiếu `-Raw`** (mục §3) |

---

## 5. Câu hỏi mở: SecureAge B1 root cause

Báo cáo gốc B1 nói lỗi `CompileAssemblyFromSource Access denied` — đây là `Add-Type` trong **keywords/base_swin.py của test framework**, KHÔNG phải driver. Không liên quan tới `{RETURN}` hay setValue.

Triệu chứng "`{RETURN}` không work" mà bạn quan sát có 3 khả năng:

1. **Password thực tế chứa `{` hoặc `}`** → F1 trigger → setValue throw exception → bạn thấy "không hoạt động".
2. **F2 race chỉ lộ trên app slow-UIA** (SecureAge ~500ms/property). Notepad fast nên không repro được.
3. **Side effect của `_ScopeW32` compile fail** — password form không có focus đúng, không liên quan trực tiếp `{RETURN}`.

### Kết quả test thực tế trên SecureAge (VM129, password `1_Abc_123`)

- Password `1_Abc_123` không chứa `{ }` → F1 không trigger.
- Test 1 (qua WDIO `el.setValue`): **WebDriverIO v9 strip mất ``** trước khi gửi xuống driver. Body HTTP chỉ có `{"text":"1_Abc_123"}`. Form dialog vẫn đóng sau 500ms — nguyên nhân không xác định (có thể form auto-submit hoặc focus shift làm trigger button khác).
- Test 2 (bypass WDIO, raw HTTP POST với  trong body):
  - Body bytes log confirm `` được gửi đúng xuống driver: `... 0031 0032 0033 e006 0022 ...`
  - `elementSendKeys` HTTP 200 trong 494ms, driver không throw.
  - Password dialog đóng sau 500ms → form submit thành công.
  - User RDP xác nhận: "nhập thành công, có vẻ chạy bình thường".
  - → **F2 KHÔNG REPRO trên SecureAge.** `setValue("pw")` work đúng trên app slow-UIA.

### Kết luận F2 (final)

Hypothesis "split SendKeys+SendInput làm Enter trôi" **không có bằng chứng thực nghiệm** trên cả Notepad lẫn SecureAge. Race condition về lý thuyết tồn tại nhưng không manifest trong pattern dùng thực tế.

---

## 6. Tại sao 1.1.8 stable mà HEAD có vấn đề?

Code path setValue **identical** giữa 1.1.8 và HEAD (verify bằng `git diff 55d5ea8 HEAD lib/commands/element.ts`). Cả F1 và F2 đã có sẵn trong 1.1.8.

Thay đổi 1.1.9+ ảnh hưởng **gián tiếp** đến biểu hiện:

| Release | Thay đổi | Tại sao có thể làm `{RETURN}`/setValue dễ lộ |
|---|---|---|
| 1.1.9 | PS auto-restart `ensurePowerShellSession` | Trước: PS chết → command fail. Sau: respawn → password gõ dở dang |
| 1.1.11 | PS protocol overhaul (UUID marker, buffer isolation, `$LASTEXITCODE`) | Framing/timing PS-Node thay đổi |
| 1.1.14 | `killProcessTree` non-blocking + timeout 60→300s | Hang lâu hơn, focus shift xa hơn |
| 1.1.17 | Queue cap 200, FIFO `$elementTable` 10k | Command có thể reject queue-cap |
| 1.1.19 | Kill PS khi stderr match OOM/StackOverflow/etc. | PS chết giữa SendKeys → password gõ dở |

→ Nếu thực sự muốn so sánh, revert về 1.1.8 trên VM rồi chạy lại test B1. Nếu pass → root cause là PS lifecycle aggression, không phải F1/F2.

---

## 7. Action recommendations

### Sửa được trong driver (low cost, clear impact)

1. **F1 narrow**: `element.ts:302` mở rộng regex thêm `{ }`. Một dòng.
2. **Bug clipboard**: `extension.ts:85` đổi `(Get-Clipboard)` → `(Get-Clipboard -Raw)`. Một dòng.

### Cần thêm dữ liệu

3. **Password thực tế của test SecureAge có `{` `}` không?** Nếu có → confirm F1 là root B1.
4. **Bypass-WDIO test trên SecureAge form** với raw HTTP `` (đang dở).
5. **A/B test 1.1.8 vs 1.1.19 cho B1** để xác định PS lifecycle có là root nguyên nhân hay không.

### Test artifacts

- `tests/e2e/stable/escape-and-return.e2e.spec.ts` — giữ. Cần thêm `afterEach` reset (Notepad close+reopen) vì failing tests làm pollution cho test sau.
- `scripts/local/test_secureage_password_return.ts` — script SecureAge one-shot. Pending test #4 lần 2.

---

## 8. Phụ lục — log error gốc từ F1 test

```
unknown error: WebDriverError: Exception calling "SendWait" with "1" argument(s):
  "Keyword "ass" is not valid."
At line:1 char:174
+ ... 0x007d)$([char]0x0077)$([char]0x006f)$([char]0x0072)$([char]0x0064)")
    + CategoryInfo          : NotSpecified: (:) [], MethodInvocationException
    + FullyQualifiedErrorId : ArgumentException
  when running "element/42.4130844/value" with method "POST"
```

`$([char]0x007d)` = `}`. Sau khi PS unescape, `[Windows.Forms.SendKeys]::SendWait("P@ss{w0rd}")` được gọi → SendKeys parser nuốt `{w0rd}` như keyword name → throw vì `w0rd` không phải keyword hợp lệ.
