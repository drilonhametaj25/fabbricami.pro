'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ShippingMethod, ApiResponse } from '@/types';

interface ShippingRatesParams {
  country: string;
  postalCode?: string;
  weight?: number;
  subtotal?: number;
}

export function useShippingMethods() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const response = await api.get<ApiResponse<ShippingMethod[]>>('/shop/shipping/methods');
        if (response.success && response.data) {
          setMethods(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch shipping methods');
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, []);

  return { methods, loading, error };
}

export function useShippingRates(params: ShippingRatesParams | null) {
  const [rates, setRates] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.country) {
      setRates([]);
      return;
    }

    const fetchRates = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.post<ApiResponse<ShippingMethod[]>>(
          '/shop/shipping/rates',
          params
        );
        if (response.success && response.data) {
          setRates(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch shipping rates');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, [params?.country, params?.postalCode, params?.weight, params?.subtotal]);

  return { rates, loading, error };
}

export function useCountries() {
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await api.get<ApiResponse<{ code: string; name: string }[]>>(
          '/shop/shipping/countries'
        );
        if (response.success && response.data) {
          setCountries(response.data);
        }
      } catch (err) {
        // Fallback to common countries
        setCountries([
          { code: 'IT', name: 'Italia' },
          { code: 'DE', name: 'Germania' },
          { code: 'FR', name: 'Francia' },
          { code: 'ES', name: 'Spagna' },
          { code: 'GB', name: 'Regno Unito' },
          { code: 'US', name: 'Stati Uniti' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  return { countries, loading, error };
}
