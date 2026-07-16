const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const app = express();
const PORT = 3001;

// Configure CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Serve static templates directly from frontend public/templates directory to avoid duplication
const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', 'docugen-fe', 'public', 'templates');
app.use('/templates', express.static(FRONTEND_TEMPLATES_DIR));

// Configure upload directory for custom templates
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `custom-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Store the path of the last uploaded custom template in memory
let lastCustomTemplatePath = '';
let lastCustomTemplateOriginalName = '';

// Helper to capitalize keys
const getUppercaseKeys = (obj) => {
  const res = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      res[key.toUpperCase()] = obj[key];
    }
  }
  return res;
};

// Helper to map all Vietnamese variations for items
const extendWithVnKeys = (item) => {
  if (!item) return {};
  return {
    'Tên hàng': item.ten_hang,
    'Tên Hàng': item.ten_hang,
    'TÊN HÀNG': item.ten_hang,
    'Tên sản phẩm': item.ten_hang,
    'Tên Sản Phẩm': item.ten_hang,
    'TÊN SẢN PHẨM': item.ten_hang,
    'Tên sản phẩm / Product Name': item.ten_hang,
    'Tên sản phẩm/Product Name': item.ten_hang,
    'Product Name': item.ten_hang,
    'PRODUCT NAME': item.ten_hang,

    'Mã hàng': item.ma_hang,
    'Mã Hàng': item.ma_hang,
    'MÃ HÀNG': item.ma_hang,
    'Mã sản phẩm': item.ma_hang,
    'Mã Sản Phẩm': item.ma_hang,
    'MÃ SẢN PHẨM': item.ma_hang,
    'Mã sản phẩm / Product Code': item.ma_hang,
    'Mã sản phẩm/Product Code': item.ma_hang,
    'Product Code': item.ma_hang,
    'PRODUCT CODE': item.ma_hang,

    'Số lượng': item.so_luong,
    'Số Lượng': item.so_luong,
    'SỐ LƯỢNG': item.so_luong,
    'Số lượng (cái)': item.so_luong,
    'SỐ LƯỢNG (CÁI)': item.so_luong,
    'Số lượng (cái)/Quantity (piece)': item.so_luong,
    'Quantity': item.so_luong,
    'QUANTITY': item.so_luong,

    'ĐVT': item.dvt,
    'Đơn vị tính': item.dvt,
    'ĐƠN VỊ TÍNH': item.dvt,
    'Unit': item.dvt,
    'UNIT': item.dvt,

    'HĐxlt Số': item.hd_xlt_so,
    'HĐxlt Ngày': item.hd_xlt_ngay,
    'HĐPM Ngày': item.hd_pm_ngay,
    'Ngày KTCL': item.ngay_ktcl,
    'Ngày ghi trên phiếu KTCL': item.ngay_ktcl,
  };
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

// Helper to map Vietnamese variations for parent sections
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
    'KHÁCH HÀNG': sec.ten_khach_hang,
    'Khách hàng / Customer': sec.ten_khach_hang,
    'Khách hàng/Customer': sec.ten_khach_hang,
    'Customer': sec.ten_khach_hang,
    'CUSTOMER': sec.ten_khach_hang,

    'Là nhà cung cấp cho': sec.nha_cung_cap_cho,
    'Là Nhà Cung Cấp Cho': sec.nha_cung_cap_cho,
    'LÀ NHÀ CUNG CẤP CHO': sec.nha_cung_cap_cho,

    'Tên công trình': sec.ten_cong_trinh,
    'Tên Công Trình': sec.ten_cong_trinh,
    'TÊN CÔNG TRÌNH': sec.ten_cong_trinh,

    'Ngày đề nghị': sec.ngay_de_nghi,
    'Ngày Đề Nghị': sec.ngay_de_nghi,
    'NGÀY ĐỀ NGHỊ': sec.ngay_de_nghi,

    'Ngày': dateFields.ngay,
    'Ngay': dateFields.ngay,
    'NGÀY': dateFields.ngay,
    'NGAY': dateFields.ngay,
    'Tháng': dateFields.thang,
    'Thang': dateFields.thang,
    'THÁNG': dateFields.thang,
    'THANG': dateFields.thang,
    'Năm': dateFields.nam,
    'Nam': dateFields.nam,
    'NĂM': dateFields.nam,
    'NAM': dateFields.nam,

    'Người đề nghị': sec.nguoi_de_nghi,
    'Người Đề Nghị': sec.nguoi_de_nghi,
    'NGƯỜI ĐỀ NGHỊ': sec.nguoi_de_nghi,
  };
};

/**
 * GET /api/templates
 * Returns available word templates.
 */
app.get('/api/templates', (req, res) => {
  const templates = [];
  res.json(templates);
});

/**
 * POST /api/templates/upload
 * Handles custom template file uploads.
 */
app.post('/api/templates/upload', upload.single('template'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Không tìm thấy file mẫu nào được đính kèm.' });
  }

  lastCustomTemplatePath = req.file.path;
  lastCustomTemplateOriginalName = req.file.originalname;

  res.json({
    url: `http://localhost:${PORT}/templates/custom`,
    schema: ['ten_hang', 'ma_hang', 'so_luong', 'ten_khach_hang', 'so_de_nghi']
  });
});

/**
 * POST /api/generate
 * Server-side docx template compilation.
 */
app.post('/api/generate', upload.single('template'), (req, res) => {
  let { templateId, data, section } = req.body;

  try {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (typeof section === 'string') {
      section = JSON.parse(section);
    }

    let templatePath = '';

    if (templateId === 'custom' || (templateId && templateId.startsWith('custom-'))) {
      if (req.file) {
        templatePath = req.file.path;
      } else {
        templatePath = lastCustomTemplatePath;
      }
      if (!templatePath) {
        return res.status(400).json({ message: 'Vui lòng upload tệp tin mẫu Word.' });
      }
    } else {
      templatePath = path.join(FRONTEND_TEMPLATES_DIR, `${templateId}.docx`);
    }

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: `Không tìm thấy file mẫu biểu tại đường dẫn: ${templatePath}` });
    }

    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);
    
    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
    } catch (zipErr) {
      return res.status(400).json({ 
        message: 'Không thể nhận diện định dạng file mẫu Word. Vui lòng đảm bảo tệp mẫu là tệp Word (.docx) hợp lệ.' 
      });
    }

    const itemsToRender = Array.isArray(data) ? data : [];
    const sec = section || {};

    const uppercaseSection = {
      SO_DE_NGHI: sec.so_de_nghi || '',
      TEN_KHACH_HANG: String(sec.ten_khach_hang || '').toUpperCase(),
      NHA_CUNG_CAP_CHO: String(sec.nha_cung_cap_cho || '').toUpperCase(),
      TEN_CONG_TRINH: String(sec.ten_cong_trinh || '').toUpperCase(),
      NGAY_DE_NGHI: sec.ngay_de_nghi || '',
      NGUOI_DE_NGHI: sec.nguoi_de_nghi || '',
    };

    // Prepare loop items
    const items = itemsToRender.map((item, idx) => {
      const uppercaseItem = getUppercaseKeys(item);
      const vnItemKeys = extendWithVnKeys(item);
      return {
        ...item,
        ...uppercaseItem,
        ...vnItemKeys,
        so_de_nghi: sec.so_de_nghi || item.so_de_nghi || '',
        ten_khach_hang: sec.ten_khach_hang || item.ten_khach_hang || '',
        nha_cung_cap_cho: sec.nha_cung_cap_cho || item.nha_cung_cap_cho || '',
        ten_cong_trinh: sec.ten_cong_trinh || item.ten_cong_trinh || '',
        ngay_de_nghi: sec.ngay_de_nghi || item.ngay_de_nghi || '',
        nguoi_de_nghi: sec.nguoi_de_nghi || item.nguoi_de_nghi || '',
        ...uppercaseSection,
        ...getVnSectionKeys(sec),
        page_break: idx < itemsToRender.length - 1,
        page_break_xml: idx < itemsToRender.length - 1 ? '<w:br w:type="page"/>' : '',
      };
    });

    const rootItem = itemsToRender[0] || {};
    const uppercaseRootItem = getUppercaseKeys(rootItem);
    const vnRootItem = extendWithVnKeys(rootItem);
    const vnSection = getVnSectionKeys(sec);

    // Compile and render
    doc.render({
      items,
      so_de_nghi: sec.so_de_nghi || '',
      ten_khach_hang: sec.ten_khach_hang || '',
      nha_cung_cap_cho: sec.nha_cung_cap_cho || '',
      ten_cong_trinh: sec.ten_cong_trinh || '',
      ngay_de_nghi: sec.ngay_de_nghi || '',
      nguoi_de_nghi: sec.nguoi_de_nghi || '',
      ...uppercaseSection,
      ...vnSection,
      
      // Fallback fields at root level for templates without loops
      ...rootItem,
      ...uppercaseRootItem,
      ...vnRootItem,
    });

    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Send binary attachment back
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=BaoCao.docx`);
    res.send(buffer);
  } catch (err) {
    console.error('Server compilation error:', err);
    let errorMessage = err.message;
    if (err.properties && Array.isArray(err.properties.errors)) {
      const detailed = err.properties.errors.map(e => {
        return e.properties?.explanation || e.message || 'Lỗi không xác định';
      }).join('; ');
      errorMessage = `${err.message} [Chi tiết: ${detailed}]`;
    }
    res.status(500).json({ message: `Lỗi biên dịch trên Server: ${errorMessage}` });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[DocuGen Server] running on http://localhost:${PORT}`);
});
