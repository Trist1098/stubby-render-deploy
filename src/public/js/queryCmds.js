const apiBaseUrl = '.';

const parseResponseBody = async (response) => {
  if (response.status === 204) return {};

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Unable to parse API response:', error);
    return { error: text };
  }
};

const fetchMethod = async (url, callback, method = 'GET', data = null) => {
  const headers = {};
  const options = {
    method: method.toUpperCase(),
    headers,
  };

  if (data !== null && method.toUpperCase() !== 'GET') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  showFetchOverlay();

  try {
    const response = await fetch(`${apiBaseUrl}${url}`, options);
    const responseData = await parseResponseBody(response);
    callback(response.status, responseData);
  } catch (error) {
    console.error(`Error from ${method.toUpperCase()} ${url}:`, error);
    callback(0, { error: 'Unable to connect to the server' });
  } finally {
    hideFetchOverlay();
  }
};

const fetchGet = (url, callback) => fetchMethod(url, callback, 'GET');

const fetchPost = (url, callback, data) => fetchMethod(url, callback, 'POST', data);

const fetchPatch = (url, callback, data) => fetchMethod(url, callback, 'PATCH', data);

const fetchPut = (url, callback, data) => fetchMethod(url, callback, 'PUT', data);

const fetchDelete = (url, callback) => fetchMethod(url, callback, 'DELETE');
