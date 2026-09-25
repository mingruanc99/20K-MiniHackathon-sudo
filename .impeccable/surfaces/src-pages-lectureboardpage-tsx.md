---
version: 1
slug: "src-pages-lectureboardpage-tsx"
primary_target: "src/pages/LectureBoardPage.tsx"
related_targets: ["src/pages/NewLecturePage.tsx","src/pages/LecturePage.tsx","src/components/layout/Navbar.tsx"]
---

# Surface brief: VideoLearn lecturer/learner surfaces

Scope: app shell (nav/footer), `/` lecture ledger (home), `/lectures/new`, `/lectures/:id` (review structure, calibrate, generate, read, fix). Mode: Operate.
Audience: Vietnamese lecturers and self-learners. Job: see which lecture needs attention and do its next step; weight time; read and fix the script.
Constraints: Vietnamese copy; honest measured numbers only; "Nâng cao" studio and /admin keep the older look. User chose to replace colors and type for these surfaces and asked for a non-generic look.

## Direction contract

THESIS: VideoLearn is the class logbook (sổ đầu bài): every lecture is a ruled entry with its minutes, the teacher's remark, and a grade stamp; status is the grade, not a colored chip. Refuses the SaaS card dashboard and the kanban of floating cards.

OWN-WORLD: deep ledger-green cover band with foil lettering; cool paper ground printed with thin green-gray rules; blue-black ink for entries; the teacher's red pen only for remarks that need fixing; circled grade stamps (Tốt, Khá, Chờ duyệt, Cần sửa). Be Vietnam Pro for the printed form, Patrick Hand only for handwritten remarks and stamps; tabular figures in every time column.

STORY: The user opens the logbook and reads it like a teacher: which entries are graded, which wait for review, which carry a red remark. Opening an entry shows its lesson plan as a ruled form they can adjust, then the script with the remarks and one-click fixes.

FIRST VIEWPORT: Cover band (VideoLearn logbook title, Sổ bài giảng, Nâng cao, model, user). Below on paper: heading row "Sổ bài giảng" with the primary "Ghi bài mới" button; ledger-edge tabs with counts; the ruled table (Tiết · Ngày · Tên bài · Thời lượng · Nhận xét · Xếp loại) filling the width, rows needing action first.

FORM: sổ đầu bài ledger (Impeccable's pick, 1st on the ordered list), seed key 3f8de6b0. Raises: rebalancing shows where time was taken from (tensegrity); system states print as ledger lines, not toasts (phosphor terminal); rules carry measurement ticks (datamatics). Signature interaction: the grade stamp presses onto the entry when a lecture is generated or re-checked.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
