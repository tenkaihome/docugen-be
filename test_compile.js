const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', 'docugen-fe', 'public', 'templates');
const templatePath = path.join(FRONTEND_TEMPLATES_DIR, 'phu-minh.docx');

console.log('Template path:', templatePath);
console.log('Exists:', fs.existsSync(templatePath));

try {
  const templateContent = fs.readFileSync(templatePath);
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const sec = {
    so_de_nghi: '7607-2026',
    ten_khach_hang: 'CTY TNHH THƯƠNG MẠI ĐIỆN PHÚ MINH',
    nha_cung_cap_cho: 'CÔNG TY TNHH THIẾT BỊ ĐIỆN KHANG TƯỜNG',
    ten_cong_trinh: 'DỰ ÁN: GLICO NEW OFFICE',
    ngay_de_nghi: 'TP, HCM ngày 03 tháng 07 năm 2026',
    nguoi_de_nghi: 'Nguyễn Thị Điệp',
    companyName: 'CTY CỔ PHẦN NAM HÀ THÀNH PLASTIC'
  };

  const item = {
    stt: '1',
    ten_hang: 'Đế âm sâu S3157H',
    ma_hang: 'S3157H',
    dvt: 'Cái',
    so_luong: '100',
    hd_xlt_so: '7840',
    hd_xlt_ngay: '17.12.25',
    hd_pm_ngay: '31.01.26',
    ngay_ktcl: '14.12.25'
  };

  const parseDateFields = (dateStr) => {
    const match = String(dateStr || '').match(/ngày\s*(\d+)\s*tháng\s*(\d+)\s*năm\s*(\d+)/i) ||
                  String(dateStr || '').match(/ngay\s*(\d+)\s*thang\s*(\d+)\s*nam\s*(\d+)/i);
    if (match) {
      return {
        ngay: match[1],
        thang: match[2],
        nam: match[3]
      };
    }
    const today = new Date();
    return {
      ngay: String(today.getDate()).padStart(2, '0'),
      thang: String(today.getMonth() + 1).padStart(2, '0'),
      nam: String(today.getFullYear())
    };
  };

  const getVnSectionKeys = (sec) => {
    if (!sec) return {};
    const dateFields = parseDateFields(sec.ngay_de_nghi || '');
    return {
      'Số phiếu': sec.so_de_nghi,
      'Số đề nghị': sec.so_de_nghi,
      'Số Phiếu': sec.so_de_nghi,
      'Số Đề Nghị': sec.so_de_nghi,
      'SỐ PHIẾU': sec.so_de_nghi,
      'SỐ ĐỀ NGHỊ': sec.so_de_nghi,
      'Khách hàng': sec.ten_khach_hang,
      'Khách Hàng': sec.ten_khach_hang,
      'Là nhà cung cấp cho': sec.nha_cung_cap_cho,
      'Là Nhà Cung Cấp Cho': sec.nha_cung_cap_cho,
      'Ngày': dateFields.ngay,
      'Tháng': dateFields.thang,
      'Năm': dateFields.nam
    };
  };

  const getUppercaseKeys = (obj) => {
    const res = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key.toUpperCase()] = obj[key];
      }
    }
    return res;
  };

  const extendWithVnKeys = (item) => {
    if (!item) return {};
    return {
      'Tên hàng': item.ten_hang,
      'Mã hàng': item.ma_hang,
      'Số lượng': item.so_luong
    };
  };

  const vnSection = getVnSectionKeys(sec);
  const uppercaseSection = {
    SO_DE_NGHI: sec.so_de_nghi || '',
    TEN_KHACH_HANG: String(sec.ten_khach_hang || '').toUpperCase()
  };

  const items = [
    {
      ...item,
      ...getUppercaseKeys(item),
      ...extendWithVnKeys(item),
      ...uppercaseSection,
      ...vnSection,
      page_break: false,
      page_break_xml: ''
    }
  ];

  doc.render({
    items,
    ...uppercaseSection,
    ...vnSection,
    ...item,
    ...getUppercaseKeys(item),
    ...extendWithVnKeys(item)
  });

  console.log('Render Succeeded!');
} catch (err) {
  console.error('Render Failed:', err);
}
