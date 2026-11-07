/**
 * Google Authentication Service (NexusPort)
 * Hỗ trợ Google Identity Services (GIS) & OAuth 2.0 Web Flow
 * Nhảy sang tab/cửa sổ chính thức của Google (accounts.google.com) với prompt='select_account'
 * để người dùng chọn tài khoản Gmail, sau đó đăng nhập vào dự án.
 */

// Google Client ID dùng chung cho cả nhóm phát triển (chạy trên localhost:5173)
export const SHARED_GOOGLE_CLIENT_ID =
  '1040811971147-9h2rn5kpsk1f8qrmdusdsnn177adoqtp.apps.googleusercontent.com';

/**
 * Lấy Client ID: Ưu tiên .env, nếu chưa cấu hình thì dùng Client ID chung của nhóm
 * @returns {string}
 */
export function getGoogleClientId() {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    window.__NEXUSPORT_GOOGLE_CLIENT_ID ||
    SHARED_GOOGLE_CLIENT_ID
  ).trim();
}

/**
 * Mở tab/popup Google để chọn tài khoản Gmail
 * @param {Object} [options]
 * @param {Function} [options.onSuccess] Callback khi nhận token thành công qua GIS
 * @param {Function} [options.onError] Callback khi có lỗi
 * @returns {Promise<void>}
 */
export async function openGoogleOAuthTab(options = {}) {
  const clientId = getGoogleClientId();
  const { onSuccess, onError } = options;

  // 1. Nếu Google Identity Services SDK đã sẵn sàng, dùng Token Client (mở popup chuẩn Google và nhận token trực tiếp)
  if (window.google?.accounts?.oauth2) {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (response) => {
          if (response.error) {
            console.error('[GoogleAuth] Lỗi OAuth:', response);
            if (onError) onError(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token && onSuccess) {
            onSuccess({ accessToken: response.access_token });
          }
        },
        error_callback: (err) => {
          console.error('[GoogleAuth] Lỗi popup:', err);
          if (onError) onError(new Error(err.message || 'Lỗi mở cửa sổ Google.'));
        },
      });

      // Mở popup chọn tài khoản của Google
      client.requestAccessToken({ prompt: 'select_account' });
      return;
    } catch (err) {
      console.warn('[GoogleAuth] GIS initTokenClient fallback to direct tab:', err);
    }
  }

  // 2. Fallback: Mở tab trực tiếp tới Google OAuth 2.0 Web Authorization Endpoint
  const redirectUri = window.location.origin + '/login';
  const scope = encodeURIComponent('openid email profile');
  const responseType = 'token id_token';
  const nonce = Math.random().toString(36).substring(2);
  const prompt = 'select_account';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=${encodeURIComponent(
    responseType
  )}&scope=${scope}&prompt=${prompt}&nonce=${nonce}`;

  const width = 520;
  const height = 650;
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);

  const popup = window.open(
    authUrl,
    'Google_Account_Login',
    `width=${width},height=${height},top=${top},left=${left},status=no,toolbar=no,menubar=no`
  );

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // Nếu popup bị chặn, chuyển hướng tab hiện tại sang Google
    window.location.href = authUrl;
  }
}

// Alias tương thích ngược
export const openGoogleAccountChooser = openGoogleOAuthTab;
