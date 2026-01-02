// src/hooks/useVans.js
import { useState, useEffect } from 'react';
import { vansAPI } from '../services/api';

export function useVans() {
  const [vans, setVans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all vans
  const loadVans = async () => {
    setLoading(true);
    try {
      const data = await vansAPI.getAll();
      setVans(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create new van
  const createVan = async (vanData) => {
    setLoading(true);
    try {
      const newVan = await vansAPI.create(vanData);
      setVans([...vans, newVan]);
      setError(null);
      return newVan;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update van
  const updateVan = async (id, vanData) => {
    setLoading(true);
    try {
      const updated = await vansAPI.update(id, vanData);
      setVans(vans.map(v => v.id === id ? updated : v));
      setError(null);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete van
  const deleteVan = async (id) => {
    setLoading(true);
    try {
      await vansAPI.delete(id);
      setVans(vans.filter(v => v.id !== id));
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load vans on mount
  useEffect(() => {
    loadVans();
  }, []);

  return {
    vans,
    loading,
    error,
    createVan,
    updateVan,
    deleteVan,
    reload: loadVans,
  };
}
