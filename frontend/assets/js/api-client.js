// Centralized API client for communicating with the PHP backend
const API_BASE = '/backend/api/v1';

/**
 * Sends a request to the PHP API with auto auth token injection.
 * Falls back gracefully to localStorage when running in a static/offline environment.
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  };

  try {
    // If running directly as file:/// or without a backend server, fallback immediately
    if (window.location.protocol === 'file:' || window.location.hostname === '') {
      throw new Error("Offline static environment detected. Falling back to local storage.");
    }

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Check content type before parsing JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Server did not return JSON. Backend might be inactive.");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    console.debug(`[API Client Fallback] ${method} ${endpoint}:`, err.message);
    return handleLocalFallback(endpoint, method, body);
  }
}

/**
 * Emulates the API behavior in localStorage for fully static deployments.
 */
function handleLocalFallback(endpoint, method, body) {
  // Normalize endpoint to extract file name/route
  const route = endpoint.split('?')[0].replace(/^\//, '');

  if (route === 'score.php') {
    if (method === 'POST') {
      const scores = JSON.parse(localStorage.getItem('syntaxcraft_scores') || '[]');
      const newScore = {
        id: Date.now(),
        quizId: body.quizId || 'general',
        score: body.score || 0,
        total: body.total || 0,
        timestamp: new Date().toISOString()
      };
      scores.push(newScore);
      localStorage.setItem('syntaxcraft_scores', JSON.stringify(scores));
      return {
        success: true,
        message: "บันทึกคะแนนลง Local Storage เรียบร้อยแล้ว (Statically Saved)",
        data: newScore
      };
    } else {
      const scores = JSON.parse(localStorage.getItem('syntaxcraft_scores') || '[]');
      return {
        success: true,
        message: "ดึงคะแนนเสร็จสิ้น",
        data: scores
      };
    }
  }

  if (route === 'progress.php') {
    if (method === 'POST') {
      const progress = JSON.parse(localStorage.getItem('syntaxcraft_progress') || '{}');
      const updated = { ...progress, ...body, updated_at: new Date().toISOString() };
      localStorage.setItem('syntaxcraft_progress', JSON.stringify(updated));
      return {
        success: true,
        message: "บันทึกความคืบหน้าการเรียนเรียบร้อยแล้ว",
        data: updated
      };
    } else {
      const progress = JSON.parse(localStorage.getItem('syntaxcraft_progress') || '{"completed_topics": [], "active_language": "js"}');
      return {
        success: true,
        message: "ดึงความคืบหน้าสำเร็จ",
        data: progress
      };
    }
  }

  // Default response
  return {
    success: true,
    message: "Local fallback executed successfully",
    data: body
  };
}

// Bind to window
window.apiRequest = apiRequest;
