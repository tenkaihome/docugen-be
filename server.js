const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const os = require('os');
const axios = require('axios');
const execPromise = util.promisify(exec);

// Initialize Firebase
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, child, remove } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyAQKorsyd689HNAtggj8-5tTyktwV_BAr4",
  authDomain: "docugen-676bf.firebaseapp.com",
  databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "docugen-676bf",
  storageBucket: "docugen-676bf.firebasestorage.app",
  messagingSenderId: "631881183468",
  appId: "1:631881183468:web:5672783e0c29c0984ef5c9",
  measurementId: "G-188PPF8BYY"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const app = express();
const PORT = 3001;

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://docugen-fe.vercel.app'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Serve static templates directly from frontend public/templates directory to avoid duplication
const FRONTEND_TEMPLATES_DIR = path.join(__dirname, '..', 'docugen-fe', 'public', 'templates');
app.use('/templates', express.static(FRONTEND_TEMPLATES_DIR));

// Configure upload storage (use memoryStorage for serverless/Vercel compatibility)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize ConvertAPI with secret key if available
const convertapi = require('convertapi')(process.env.CONVERTAPI_SECRET || '');

// Helper to convert legacy .doc file to modern .docx using ConvertAPI (online) or MS Word COM (local fallback)
async function convertDocToDocx(docBuffer) {
  const tempId = crypto.randomBytes(16).toString('hex');
  const tempDocPath = path.join(os.tmpdir(), `temp_${tempId}.doc`).replace(/\\/g, '/');
  const tempDocxPath = path.join(os.tmpdir(), `temp_${tempId}.docx`).replace(/\\/g, '/');

  try {
    // Write docBuffer to temporary .doc file
    fs.writeFileSync(tempDocPath, docBuffer);

    if (process.env.CONVERTAPI_SECRET) {
      console.log('[DocuGen Server] Converting .doc to .docx using ConvertAPI...');
      const result = await convertapi.convert('docx', {
        File: tempDocPath
      }, 'doc');
      
      await result.file.save(tempDocxPath);
      const docxBuffer = fs.readFileSync(tempDocxPath);
      return docxBuffer;
    }

    // Fallback to local MS Word COM Object (only works on local Windows machines)
    // PowerShell script to convert using MS Word
    const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$word = New-Object -ComObject Word.Application; $word.Visible = $false; try { $doc = $word.Documents.Open('${tempDocPath}'); $doc.SaveAs('${tempDocxPath}', 16); $doc.Close() } finally { $word.Quit() }"`;

    console.log('[DocuGen Server] Running PowerShell conversion from .doc to .docx...');
    await execPromise(psCommand);

    if (!fs.existsSync(tempDocxPath)) {
      throw new Error('PowerShell conversion completed but the output .docx file was not found.');
    }

    // Read converted docx back
    const docxBuffer = fs.readFileSync(tempDocxPath);
    return docxBuffer;
  } catch (err) {
    console.error('[DocuGen Server] doc-to-docx conversion failed:', err);
    throw new Error(`Lỗi chuyển đổi file .doc sang .docx: ${err.message}`);
  } finally {
    // Clean up temporary files
    if (fs.existsSync(tempDocPath)) {
      try { fs.unlinkSync(tempDocPath); } catch (e) {}
    }
    if (fs.existsSync(tempDocxPath)) {
      try { fs.unlinkSync(tempDocxPath); } catch (e) {}
    }
  }
}

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

const parseVietnameseDate = (dateStr) => {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  if (!clean) return null;

  // Check if it is ISO format or serialized date
  if (clean.includes('T') && !isNaN(Date.parse(clean))) {
    return new Date(clean);
  }

  // Check if there are dots (e.g. 11.10.25)
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // Fallback to standard JS Date parsing
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  // Check if there are slashes (e.g. 25/03/2026)
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  return null;
};

const calculateNgayXuatXuong = (item, sec) => {
  const companyName = sec.ten_khach_hang || sec.companyName || '';
  const companyId = sec.companyId || '';
  const isNamHaThanh = 
    companyName.toUpperCase().includes('NAM HÀ THÀNH') || 
    companyName.toUpperCase().includes('NAM HA THANH') || 
    companyId.includes('nam-ha-thanh');

  const rawDateStr = item.hd_xlt_ngay || '';
  const parsedDate = parseVietnameseDate(rawDateStr);

  if (!parsedDate) {
    return parseDateFields(sec.ngay_de_nghi || '');
  }

  if (!isNamHaThanh) {
    parsedDate.setDate(parsedDate.getDate() - 3);
  }

  return {
    ngay: String(parsedDate.getDate()).padStart(2, '0'),
    thang: String(parsedDate.getMonth() + 1).padStart(2, '0'),
    nam: String(parsedDate.getFullYear())
  };
};

const formatSoDocx = (soDeNghi, hdXltSo) => {
  const cleanSoDeNghi = String(soDeNghi || '').trim();
  const parts = cleanSoDeNghi.split('-');
  const firstPart = parts[0] ? parts[0].trim() : '';
  const cleanHdXltSo = String(hdXltSo || '').trim();

  if (firstPart && cleanHdXltSo) {
    return `${firstPart}/${cleanHdXltSo}`;
  } else if (cleanHdXltSo) {
    return cleanHdXltSo;
  } else {
    return firstPart;
  }
};

const matchPrefix = (maHang, mappings) => {
  if (!maHang || !mappings) return null;
  const cleanMaHang = String(maHang).trim().toUpperCase();
  const prefixes = Object.keys(mappings).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (cleanMaHang.startsWith(prefix.trim().toUpperCase())) {
      return mappings[prefix];
    }
  }
  return null;
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
    'Số': sec.so_de_nghi,
    'số': sec.so_de_nghi,
    'SỐ': sec.so_de_nghi,
    'so': sec.so_de_nghi,
    'SO': sec.so_de_nghi,

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
 * Returns available word templates from Firebase Realtime DB.
 * Omit fileBase64 for optimal network load.
 */
app.get('/api/templates', async (req, res) => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'templates'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.values(data).map(item => {
        const { fileBase64, ...rest } = item;
        return rest;
      });
      res.json(list);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to fetch templates from Firebase:', error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách mẫu từ Firebase' });
  }
});

/**
 * POST /api/templates/upload
 * Uploads a template file and saves details (with base64 content) to Firebase Database.
 */
app.post('/api/templates/upload', upload.single('template'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Vui lòng upload tệp tin mẫu Word.' });
  }

  try {
    let templateContent = req.file.buffer;
    let originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    if (originalName.toLowerCase().endsWith('.doc')) {
      templateContent = await convertDocToDocx(templateContent);
      originalName = originalName.slice(0, -4) + '.docx';
    }

    const zip = new PizZip(templateContent);

    // Extract variables schema from XML
    let schema = [];
    try {
      const docXml = zip.files['word/document.xml'].asText();
      const matches = docXml.match(/\{([^{}]+)\}/g) || [];
      const variables = matches.map(m => {
        const clean = m.replace(/<[^>]+>/g, '').replace(/[\{\}]/g, '').trim();
        return clean;
      }).filter(v => /^[a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂĐĨŨƠưăâđĩũơ\s-]+$/.test(v));

      schema = Array.from(new Set(variables));
    } catch (parseErr) {
      console.warn('Failed to parse template schema:', parseErr);
    }

    const base64String = templateContent.toString('base64');
    const templateId = `custom-${Date.now()}`;
    const templateData = {
      id: templateId,
      name: originalName.replace(/\.docx$/i, ''),
      fileBase64: base64String,
      mappingSchema: schema
    };

    await set(ref(db, `templates/${templateId}`), templateData);

    res.json({
      url: '',
      schema: schema,
      template: {
        id: templateId,
        name: templateData.name,
        mappingSchema: schema
      }
    });
  } catch (err) {
    console.error('Upload template failed:', err);
    res.status(500).json({ message: `Không thể tải lên tệp mẫu: ${err.message}` });
  }
});

/**
 * DELETE /api/templates/:id
 * Deletes a template from Firebase Database.
 */
app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const templateRef = ref(db, `templates/${id}`);
    const snapshot = await get(templateRef);
    if (snapshot.exists()) {
      await remove(templateRef);
      res.json({ success: true });
    } else {
      res.status(404).json({ message: 'Không tìm thấy mẫu cần xóa' });
    }
  } catch (error) {
    console.error('Failed to delete template from Firebase:', error);
    res.status(500).json({ message: 'Lỗi khi xóa mẫu khỏi Firebase' });
  }
});

/**
 * GET /api/templates/:id/download
 * Downloads a template from Firebase Database (base64 decoded).
 */
app.get('/api/templates/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const snapshot = await get(ref(db, `templates/${id}`));
    if (snapshot.exists()) {
      const template = snapshot.val();
      if (template.fileBase64) {
        const fileBuffer = Buffer.from(template.fileBase64, 'base64');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(template.name)}.docx"`);
        return res.send(fileBuffer);
      } else {
        return res.status(404).json({ message: 'Tệp mẫu không có nội dung file.' });
      }
    } else {
      return res.status(404).json({ message: 'Không tìm thấy mẫu biểu.' });
    }
  } catch (error) {
    console.error('Failed to download template:', error);
    res.status(500).json({ message: 'Lỗi khi tải xuống tệp mẫu' });
  }
});

/**
 * POST /api/generate
 * Server-side docx template compilation.
 */
app.post('/api/generate', upload.single('template'), async (req, res) => {
  let { templateId, data, section, productNameMappings } = req.body;

  try {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (typeof section === 'string') {
      section = JSON.parse(section);
    }
    if (typeof productNameMappings === 'string') {
      productNameMappings = JSON.parse(productNameMappings);
    }

    let templateContent;

    if (templateId === 'custom' || (templateId && templateId.startsWith('custom-'))) {
      if (req.file) {
        templateContent = req.file.buffer;
        if (req.file.originalname.toLowerCase().endsWith('.doc')) {
          templateContent = await convertDocToDocx(templateContent);
        }
      } else if (templateId && templateId.startsWith('custom-')) {
        // Fetch from Firebase Realtime DB (base64 string)
        try {
          const snapshot = await get(ref(db, `templates/${templateId}`));
          if (snapshot.exists()) {
            const template = snapshot.val();
            if (template.fileBase64) {
              templateContent = Buffer.from(template.fileBase64, 'base64');
            } else {
              return res.status(400).json({ message: `Tệp mẫu ${templateId} thiếu nội dung dữ liệu base64.` });
            }
          } else {
            return res.status(404).json({ message: `Không tìm thấy tệp mẫu ${templateId} trên Firebase.` });
          }
        } catch (fbErr) {
          console.error('Failed to fetch template from Firebase DB:', fbErr);
          return res.status(500).json({ message: `Lỗi tải tệp mẫu từ Firebase: ${fbErr.message}` });
        }
      } else {
        templateContent = null;
      }

      if (!templateContent) {
        return res.status(400).json({ message: 'Vui lòng upload tệp tin mẫu Word.' });
      }
    } else {
      const templatePath = path.join(FRONTEND_TEMPLATES_DIR, `${templateId}.docx`);
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: `Không tìm thấy file mẫu biểu tại đường dẫn: ${templatePath}` });
      }
      templateContent = fs.readFileSync(templatePath);
    }
    const zip = new PizZip(templateContent);
    if (!zip.files['word/document.xml']) {
      return res.status(400).json({
        message: 'Không thể nhận diện định dạng file mẫu Word. Vui lòng đảm bảo tệp mẫu là tệp Word (.docx) hợp lệ.'
      });
    }

    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
    } catch (compileErr) {
      console.error('Docxtemplater compilation failed:', compileErr);
      let details = compileErr.message;
      if (compileErr.properties && compileErr.properties.errors) {
        details = compileErr.properties.errors.map(e => e.message).join(', ');
      }
      return res.status(400).json({
        message: `Lỗi cấu trúc biểu mẫu Word: ${details}`
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

      const calculatedDate = calculateNgayXuatXuong(item, sec);
      const calculatedSo = formatSoDocx(sec.so_de_nghi, item.hd_xlt_so);

      const itemDateAndSoFields = {
        'Ngày': calculatedDate.ngay,
        'Ngay': calculatedDate.ngay,
        'NGÀY': calculatedDate.ngay,
        'NGAY': calculatedDate.ngay,
        'Tháng': calculatedDate.thang,
        'Thang': calculatedDate.thang,
        'THÁNG': calculatedDate.thang,
        'THANG': calculatedDate.thang,
        'Năm': calculatedDate.nam,
        'Nam': calculatedDate.nam,
        'NĂM': calculatedDate.nam,
        'NAM': calculatedDate.nam,

        'Số': calculatedSo,
        'số': calculatedSo,
        'SỐ': calculatedSo,
        'so': calculatedSo,
        'SO': calculatedSo,
      };

      let itemProductFields = {};
      const mappedProductName = matchPrefix(item.ma_hang, productNameMappings);
      if (mappedProductName) {
        itemProductFields = {
          'Tên sản phẩm': mappedProductName,
          'Tên Sản Phẩm': mappedProductName,
          'TÊN SẢN PHẨM': mappedProductName,
          'Tên sản phẩm / Product Name': mappedProductName,
          'Tên sản phẩm/Product Name': mappedProductName,
          'Product Name': mappedProductName,
          'PRODUCT NAME': mappedProductName,
        };
      }

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
        ...itemDateAndSoFields,
        ...itemProductFields,
        page_break: idx < itemsToRender.length - 1,
        page_break_xml: idx < itemsToRender.length - 1 ? '<w:br w:type="page"/>' : '',
      };
    });

    const rootItem = itemsToRender[0] || {};
    const uppercaseRootItem = getUppercaseKeys(rootItem);
    const vnRootItem = extendWithVnKeys(rootItem);
    const vnSection = getVnSectionKeys(sec);

    // Fallback date and number for root level (based on the first item)
    let rootDateAndSoFields = {};
    let rootProductFields = {};
    if (rootItem && Object.keys(rootItem).length > 0) {
      const firstItemCalculatedDate = calculateNgayXuatXuong(rootItem, sec);
      const firstItemCalculatedSo = formatSoDocx(sec.so_de_nghi, rootItem.hd_xlt_so);
      rootDateAndSoFields = {
        'Ngày': firstItemCalculatedDate.ngay,
        'Ngay': firstItemCalculatedDate.ngay,
        'NGÀY': firstItemCalculatedDate.ngay,
        'NGAY': firstItemCalculatedDate.ngay,
        'Tháng': firstItemCalculatedDate.thang,
        'Thang': firstItemCalculatedDate.thang,
        'THÁNG': firstItemCalculatedDate.thang,
        'THANG': firstItemCalculatedDate.thang,
        'Năm': firstItemCalculatedDate.nam,
        'Nam': firstItemCalculatedDate.nam,
        'NĂM': firstItemCalculatedDate.nam,
        'NAM': firstItemCalculatedDate.nam,

        'Số': firstItemCalculatedSo,
        'số': firstItemCalculatedSo,
        'SỐ': firstItemCalculatedSo,
        'so': firstItemCalculatedSo,
        'SO': firstItemCalculatedSo,
      };

      const rootMappedProductName = matchPrefix(rootItem.ma_hang, productNameMappings);
      if (rootMappedProductName) {
        rootProductFields = {
          'Tên sản phẩm': rootMappedProductName,
          'Tên Sản Phẩm': rootMappedProductName,
          'TÊN SẢN PHẨM': rootMappedProductName,
          'Tên sản phẩm / Product Name': rootMappedProductName,
          'Tên sản phẩm/Product Name': rootMappedProductName,
          'Product Name': rootMappedProductName,
          'PRODUCT NAME': rootMappedProductName,
        };
      }
    }

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
      ...rootDateAndSoFields,

      // Fallback fields at root level for templates without loops
      ...rootItem,
      ...uppercaseRootItem,
      ...vnRootItem,
      ...rootProductFields,
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
/**dark */
/**
 * GET /api/templates/:id/download
 * Downloads the original template document by ID.
 */
app.get('/api/templates/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const snapshot = await get(ref(db, `templates/${id}`));
    if (snapshot.exists()) {
      const template = snapshot.val();
      if (template.fileBase64) {
        const buffer = Buffer.from(template.fileBase64, 'base64');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}.docx"`);
        res.send(buffer);
      } else {
        res.status(400).json({ message: 'Mẫu biểu này không có dữ liệu tệp tin đính kèm.' });
      }
    } else {
      res.status(404).json({ message: 'Không tìm thấy mẫu biểu được yêu cầu.' });
    }
  } catch (error) {
    console.error('Failed to download template:', error);
    res.status(500).json({ message: 'Lỗi tải tệp mẫu từ Firebase' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[DocuGen Server] running on http://localhost:${PORT}`);
});

module.exports = app;
