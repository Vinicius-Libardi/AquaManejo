/* Centraliza URL, credenciais de sessão e tratamento do contrato da API. */
(() => {
  const baseUrl = document.querySelector('meta[name="api-base-url"]')?.content || '/api';

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        credentials: 'same-origin',
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.');
    }

    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `A solicitação falhou (HTTP ${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.code = payload?.error?.code;
      error.details = payload?.error?.details;
      throw error;
    }
    return payload?.data;
  }

  window.aquaApi = Object.freeze({
    request,
    get: (path) => request(path),
    post: (path, value) => request(path, { method: 'POST', body: JSON.stringify(value) }),
    patch: (path, value) => request(path, { method: 'PATCH', body: JSON.stringify(value) }),
    delete: (path) => request(path, { method: 'DELETE' })
  });
})();
