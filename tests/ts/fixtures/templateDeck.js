// tests/ts/fixtures/templateDeck.js
// A 10-page Vietnamese deck covering every line shape the template composer handles:
// definitions, metrics, formula, code, example, nested steps, pros/cons, flat fragments,
// a read table and a read diagram.
const el = (sid, n, type, text, level = 2, extra = {}) => ({ element_id: `${sid}_el_${n}`, type, text, level, ...extra });

const pages = [
  ['Mạng nơ-ron tích chập', [['bullet_point', 'Học đặc trưng trực tiếp từ ảnh'], ['bullet_point', 'Được dùng rộng rãi trong thị giác máy tính']]],
  ['Các khái niệm cơ bản', [['bullet_point', 'Kernel: ma trận trọng số nhỏ trượt trên ảnh'], ['bullet_point', 'Stride = 2'], ['bullet_point', 'Padding: thêm viền số 0 quanh ảnh'], ['bullet_point', 'ReLU: giúp mô hình học phi tuyến']]],
  ['Huấn luyện mô hình', [['bullet_point', 'Quy trình huấn luyện:', 2], ['bullet_point', 'Chuẩn hoá dữ liệu', 3], ['bullet_point', 'Khởi tạo trọng số', 3], ['bullet_point', 'Lan truyền xuôi', 3], ['bullet_point', 'Tính hàm mất mát', 3], ['bullet_point', 'Cập nhật trọng số bằng Adam', 3]]],
  ['Đánh giá CNN', [['bullet_point', 'Ưu điểm:', 2], ['bullet_point', 'Chia sẻ trọng số', 3], ['bullet_point', 'Ít tham số hơn mạng kết nối đầy đủ', 3], ['bullet_point', 'Nhược điểm:', 2], ['bullet_point', 'Cần nhiều dữ liệu gán nhãn', 3], ['bullet_point', 'Khó giải thích', 3]]],
  ['So sánh kiến trúc', [['table', '', 2, { region_id: 'R5' }]]],
  ['Kiến trúc tổng quát', [['bullet_point', 'Dữ liệu đi qua bốn khối chính'], ['diagram', '', 2, { region_id: 'R6' }]]],
  ['Hàm kích hoạt', [['equation', 'y = max(0, x)'], ['code', 'layer = nn.Conv2d(3, 16, kernel_size=3)'], ['bullet_point', 'Ví dụ: ảnh 32x32 qua kernel 3x3 cho ra feature map 30x30']]],
  ['Các loại pooling', [['bullet_point', 'Max pooling'], ['bullet_point', 'Average pooling'], ['bullet_point', 'Global average pooling']]],
  ['Kết quả thực nghiệm', [['bullet_point', 'Độ chính xác: 92,5%'], ['bullet_point', 'Thời gian huấn luyện: 3 giờ'], ['bullet_point', 'Số tham số – 1,2 triệu']]],
  ['Tổng kết', [['bullet_point', 'Tích chập trích xuất đặc trưng cục bộ'], ['bullet_point', 'Pooling giảm kích thước'], ['bullet_point', 'Kết nối đầy đủ đưa ra dự đoán']]]
];

const sections = pages.map(([title, items], i) => {
  const sid = `S${i + 1}`;
  const elements = [el(sid, '00', 'title', title, 1), ...items.map(([type, text, level, extra], k) => el(sid, String(k + 1).padStart(2, '0'), type, text, level ?? 2, extra || {}))];
  return {
    section_id: sid,
    title,
    order: i + 1,
    elements,
    raw_text: elements.filter((e) => e.text).map((e) => e.text).join('\n')
  };
});

const done = (extra) => ({ engine: 'tesseract', status: 'done', confidence: 0.94, ...extra });
const visual_regions = [
  {
    region_id: 'R5', section_id: 'S5', page_number: 5, kind: 'table', bbox: [0.1, 0.2, 0.9, 0.8],
    ocr: done({ content_type: 'table', text: 'Mô hình Tham số Độ chính xác LeNet-5 60 nghìn 98,9% AlexNet 60 triệu 84,7% ResNet-50 25 triệu 92,1%', table: [['Mô hình', 'Tham số', 'Độ chính xác'], ['LeNet-5', '60 nghìn', '98,9%'], ['AlexNet', '60 triệu', '84,7%'], ['ResNet-50', '25 triệu', '92,1%']] })
  },
  {
    region_id: 'R6', section_id: 'S6', page_number: 6, kind: 'diagram', bbox: [0.1, 0.3, 0.9, 0.7],
    ocr: done({ content_type: 'diagram', text: 'Ảnh đầu vào Tích chập Pooling Kết nối đầy đủ', nodes: ['Ảnh đầu vào', 'Tích chập', 'Pooling', 'Kết nối đầy đủ'] })
  }
];

export const templateDeck = {
  document_id: 'doc_template_deck',
  title: 'Mạng nơ-ron tích chập',
  source_type: 'pptx',
  source_filename: 'template-deck.pptx',
  total_sections: sections.length,
  sections,
  visual_regions,
  extraction_time_ms: 1
};
