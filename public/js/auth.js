window.Auth = {
    async me() {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (!r.ok) throw new Error('unauthorized');
      return r.json();
    }
  };
  