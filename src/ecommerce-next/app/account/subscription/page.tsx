'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Calendar,
  Check,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';

interface Plan {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: Record<string, number>;
}

interface Subscription {
  id: string;
  status: string;
  plan: {
    code: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
  };
  billingPeriod: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subData, plansData] = await Promise.all([
        api.get<Subscription>('/subscription').catch(() => null),
        api.get<Plan[]>('/subscription/plans'),
      ]);

      setSubscription(subData);
      setPlans(plansData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planCode: string) => {
    try {
      setActionLoading(planCode);

      const { url } = await api.post<{ url: string }>('/subscription/checkout', {
        planCode,
        billingPeriod: 'MONTHLY',
        successUrl: `${window.location.origin}/account/subscription?success=true`,
        cancelUrl: `${window.location.origin}/account/subscription?canceled=true`,
      });

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante upgrade');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading('portal');

      const { url } = await api.post<{ url: string }>('/subscription/portal', {
        returnUrl: `${window.location.origin}/account/subscription`,
      });

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore apertura portale');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Sei sicuro di voler cancellare il tuo abbonamento?')) return;

    try {
      setActionLoading('cancel');
      await api.delete('/subscription');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore cancellazione');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const currentPlanCode = subscription?.plan?.code || 'STARTER';
  const isTrialing = subscription?.status === 'TRIALING';
  const isCanceled = subscription?.cancelAtPeriodEnd;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Gestione Abbonamento
        </h2>
        <p className="text-text-secondary mt-1">
          Gestisci il tuo piano e i metodi di pagamento
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-error/10 border border-error/20 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-error font-medium">Si e verificato un errore</p>
            <p className="text-error/80 text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Current Subscription */}
      <div className="bg-surface-card rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Piano Attuale
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-gold">
                {subscription?.plan?.name || 'Nessun piano'}
              </span>
              {isTrialing && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                  Trial
                </span>
              )}
              {isCanceled && (
                <span className="px-2 py-1 text-xs font-medium bg-error/20 text-error rounded-full">
                  In cancellazione
                </span>
              )}
            </div>
          </div>
          <CreditCard className="w-10 h-10 text-gold/50" />
        </div>

        {subscription && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-text-secondary text-sm">Prezzo</p>
              <p className="text-white font-semibold mt-1">
                {subscription.billingPeriod === 'YEARLY'
                  ? `${subscription.plan.priceYearly}/anno`
                  : `${subscription.plan.priceMonthly}/mese`
                }
              </p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-text-secondary text-sm">Periodo</p>
              <p className="text-white font-semibold mt-1">
                {subscription.billingPeriod === 'YEARLY' ? 'Annuale' : 'Mensile'}
              </p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4">
              <p className="text-text-secondary text-sm">
                {isCanceled ? 'Scade il' : 'Rinnovo'}
              </p>
              <p className="text-white font-semibold mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-secondary" />
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('it-IT')}
              </p>
            </div>
          </div>
        )}

        {isTrialing && subscription?.trialEndsAt && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-sm">
              Il tuo periodo di prova termina il{' '}
              <strong>{new Date(subscription.trialEndsAt).toLocaleDateString('it-IT')}</strong>.
              Aggiungi un metodo di pagamento per continuare dopo il trial.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleManageBilling}
            disabled={actionLoading === 'portal'}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-primary font-medium rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'portal' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Gestisci Pagamenti
          </button>

          {!isCanceled && subscription && (
            <button
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
              className="flex items-center gap-2 px-4 py-2 border border-error/30 text-error font-medium rounded-lg hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'cancel' && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Cancella Abbonamento
            </button>
          )}
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Piani Disponibili
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.code === currentPlanCode;
            const isUpgrade = plans.findIndex(p => p.code === plan.code) >
                             plans.findIndex(p => p.code === currentPlanCode);

            return (
              <motion.div
                key={plan.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative bg-surface-card rounded-2xl p-6 border-2 transition-colors ${
                  isCurrent
                    ? 'border-gold'
                    : 'border-transparent hover:border-gold/30'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-gold text-primary text-xs font-bold rounded-full">
                      ATTUALE
                    </span>
                  </div>
                )}

                <h4 className="text-xl font-bold text-white">{plan.name}</h4>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gold">{plan.priceMonthly}</span>
                  <span className="text-text-secondary">/mese</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.slice(0, 5).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <button
                    onClick={() => handleUpgrade(plan.code)}
                    disabled={actionLoading === plan.code}
                    className={`mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isUpgrade
                        ? 'bg-gold text-primary hover:bg-gold/90'
                        : 'bg-surface-raised text-white hover:bg-surface-raised/80'
                    } disabled:opacity-50`}
                  >
                    {actionLoading === plan.code ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {isUpgrade ? 'Upgrade' : 'Downgrade'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-surface-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Domande Frequenti
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-white font-medium">Posso cambiare piano in qualsiasi momento?</p>
            <p className="text-text-secondary text-sm mt-1">
              Si, puoi effettuare upgrade o downgrade in qualsiasi momento.
              L'importo sara calcolato in modo proporzionale.
            </p>
          </div>
          <div>
            <p className="text-white font-medium">Cosa succede se cancello?</p>
            <p className="text-text-secondary text-sm mt-1">
              Il tuo account restera attivo fino alla fine del periodo di fatturazione corrente.
              Potrai riattivare l'abbonamento in qualsiasi momento.
            </p>
          </div>
          <div>
            <p className="text-white font-medium">I miei dati sono al sicuro?</p>
            <p className="text-text-secondary text-sm mt-1">
              Utilizziamo Stripe per gestire i pagamenti. Non memorizziamo mai i dati
              della tua carta sui nostri server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
