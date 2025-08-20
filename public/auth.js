window.Auth = {
  async me() {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Будь ласка, увійдіть знову.');
      window.location.href = "/admin-login.html";
      throw new Error('unauthorized');
    }

    try {
      const r = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!r.ok) {
        alert('Сесія закінчилася, увійдіть знову.');
        window.location.href = "/admin-login.html";
        throw new Error('unauthorized');
      }

      const userData = await r.json();
      if (!userData.isAdmin) {
        alert('У вас немає прав адміністратора.');
        window.location.href = "/admin-login.html";
        throw new Error('forbidden');
      }

      return userData;
    } catch (error) {
      console.error("Authorization error:", error);
      window.location.href = "/admin-login.html";
      throw error;
    }
  }
};