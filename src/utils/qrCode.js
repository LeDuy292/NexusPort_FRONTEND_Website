/**
 * Hàm tiện ích xử lý mã QR Code
 */

// Tạo URL mã QR chứa dữ liệu để quét tại cổng (Gate Check-in)
export function generateGateQRData(bookingId, containerNo, driverLicense) {
  const dataObj = {
    bookingId,
    containerNo,
    driverLicense,
    timestamp: new Date().toISOString()
  }
  
  // Trả về dữ liệu dạng JSON String
  return JSON.stringify(dataObj)
}

// Kiểm tra tính hợp lệ của mã QR Code quét được từ ứng dụng tài xế
export function parseAndValidateQRData(qrString) {
  try {
    const parsed = JSON.parse(qrString)
    if (parsed.bookingId && parsed.containerNo) {
      return { isValid: true, data: parsed }
    }
    return { isValid: false, error: 'Mã QR không khớp định dạng cổng kiểm soát.' }
  } catch (e) {
    return { isValid: false, error: 'Dữ liệu mã QR bị hỏng hoặc không hợp lệ.' }
  }
}
