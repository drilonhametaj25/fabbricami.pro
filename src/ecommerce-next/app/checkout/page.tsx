'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Truck,
  User,
  Lock,
} from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useShippingMethods, useCountries } from '@/hooks/useShipping';
import { formatPrice } from '@/lib/utils';
import { api } from '@/lib/api';
import type { ApiResponse } from '@/types';

type CheckoutStep = 'info' | 'shipping' | 'payment';

const steps: { key: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { key: 'info', label: 'Informazioni', icon: User },
  { key: 'shipping', label: 'Spedizione', icon: Truck },
  { key: 'payment', label: 'Pagamento', icon: CreditCard },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, loading: cartLoading, clearCart } = useCartStore();
  const { customer } = useAuthStore();
  const { methods: shippingMethods, loading: shippingLoading } = useShippingMethods();
  const { countries } = useCountries();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    // Contact
    email: customer?.email || '',
    phone: '',

    // Shipping Address
    firstName: '',
    lastName: '',
    company: '',
    address: '',
    addressLine2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'IT',

    // Billing (if different)
    billingDifferent: false,
    billingFirstName: '',
    billingLastName: '',
    billingCompany: '',
    billingAddress: '',
    billingAddressLine2: '',
    billingCity: '',
    billingProvince: '',
    billingPostalCode: '',
    billingCountry: 'IT',

    // Shipping
    shippingMethodId: '',

    // Payment
    paymentMethod: 'stripe',
    savePaymentInfo: false,

    // Notes
    notes: '',
  });

  // Update email when customer loads
  useEffect(() => {
    if (customer?.email) {
      setFormData((prev) => ({ ...prev, email: customer.email }));
    }
  }, [customer]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartLoading && (!cart || cart.items.length === 0)) {
      router.push('/cart');
    }
  }, [cart, cartLoading, router]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleNextStep = () => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].key);
    }
  };

  const handlePreviousStep = () => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].key);
    }
  };

  const validateStep = (step: CheckoutStep): boolean => {
    switch (step) {
      case 'info':
        return !!(
          formData.email &&
          formData.firstName &&
          formData.lastName &&
          formData.address &&
          formData.city &&
          formData.postalCode &&
          formData.country
        );
      case 'shipping':
        return !!formData.shippingMethodId;
      case 'payment':
        return !!formData.paymentMethod;
      default:
        return false;
    }
  };

  const handleSubmitOrder = async () => {
    if (!validateStep('payment')) return;

    setIsSubmitting(true);
    setError('');

    try {
      const orderData = {
        contact: {
          email: formData.email,
          phone: formData.phone,
        },
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          address: formData.address,
          addressLine2: formData.addressLine2,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        billingAddress: formData.billingDifferent
          ? {
              firstName: formData.billingFirstName,
              lastName: formData.billingLastName,
              company: formData.billingCompany,
              address: formData.billingAddress,
              addressLine2: formData.billingAddressLine2,
              city: formData.billingCity,
              province: formData.billingProvince,
              postalCode: formData.billingPostalCode,
              country: formData.billingCountry,
            }
          : null,
        shippingMethodId: formData.shippingMethodId,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      };

      const response = await api.post<ApiResponse<{ orderId: string; paymentUrl?: string }>>(
        '/shop/checkout',
        orderData
      );

      if (response.success && response.data) {
        // If there's a payment URL (Stripe/PayPal), redirect to it
        if (response.data.paymentUrl) {
          window.location.href = response.data.paymentUrl;
        } else {
          // Clear cart and redirect to confirmation
          clearCart();
          router.push(`/checkout/confirmation?orderId=${response.data.orderId}`);
        }
      } else {
        throw new Error('Failed to create order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Si e verificato un errore');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedShippingMethod = shippingMethods.find(
    (m) => m.id === formData.shippingMethodId
  );

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/cart" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            Torna al Carrello
          </Link>
          <div className="flex items-center gap-2 text-gold">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Checkout Sicuro</span>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-12">
          {steps.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = steps.findIndex((s) => s.key === currentStep) > index;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => isCompleted && setCurrentStep(step.key)}
                  disabled={!isCompleted}
                  className={`flex items-center gap-2 ${
                    isActive
                      ? 'text-gold'
                      : isCompleted
                      ? 'text-success cursor-pointer'
                      : 'text-text-muted cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-gold text-primary'
                        : isCompleted
                        ? 'bg-success text-white'
                        : 'bg-surface-card text-text-muted'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="hidden md:block font-medium">{step.label}</span>
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={`w-8 md:w-16 h-0.5 ${
                      isCompleted ? 'bg-success' : 'bg-surface-card'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {currentStep === 'info' && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Contact Info */}
                  <div className="bg-surface-card rounded-2xl p-6">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">
                      Informazioni di Contatto
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Telefono
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="bg-surface-card rounded-2xl p-6">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">
                      Indirizzo di Spedizione
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Nome *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Cognome *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Azienda (opzionale)
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Indirizzo *
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Appartamento, interno, etc. (opzionale)
                        </label>
                        <input
                          type="text"
                          name="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Citta *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Provincia
                        </label>
                        <input
                          type="text"
                          name="province"
                          value={formData.province}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          CAP *
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Paese *
                        </label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white focus:outline-none focus:border-gold/50"
                        >
                          {countries.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Billing Different Checkbox */}
                    <label className="flex items-center gap-3 mt-6 cursor-pointer">
                      <input
                        type="checkbox"
                        name="billingDifferent"
                        checked={formData.billingDifferent}
                        onChange={handleInputChange}
                        className="w-5 h-5 rounded border-white/20 bg-surface-raised text-gold focus:ring-gold/50"
                      />
                      <span className="text-text-secondary">
                        Usa un indirizzo di fatturazione diverso
                      </span>
                    </label>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleNextStep}
                      disabled={!validateStep('info')}
                      className="btn-primary btn-large"
                    >
                      Continua
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 'shipping' && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="bg-surface-card rounded-2xl p-6">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">
                      Metodo di Spedizione
                    </h2>

                    {shippingLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-20 bg-surface-raised rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {shippingMethods.map((method) => (
                          <label
                            key={method.id}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                              formData.shippingMethodId === method.id
                                ? 'border-gold bg-gold/10'
                                : 'border-white/10 hover:border-gold/50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <input
                                type="radio"
                                name="shippingMethodId"
                                value={method.id}
                                checked={formData.shippingMethodId === method.id}
                                onChange={handleInputChange}
                                className="w-5 h-5 text-gold focus:ring-gold/50"
                              />
                              <div>
                                <p className="font-medium text-white">{method.name}</p>
                                <p className="text-sm text-text-secondary">
                                  {method.estimatedDaysMin === method.estimatedDaysMax
                                    ? `${method.estimatedDaysMin} giorni lavorativi`
                                    : `${method.estimatedDaysMin}-${method.estimatedDaysMax} giorni lavorativi`}
                                </p>
                              </div>
                            </div>
                            <span className="font-semibold text-gold">
                              {method.baseCost === 0 ? 'Gratis' : formatPrice(method.baseCost)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="bg-surface-card rounded-2xl p-6">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">
                      Note (opzionale)
                    </h2>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Istruzioni speciali per la consegna..."
                      rows={3}
                      className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-gold/50 resize-none"
                    />
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between">
                    <button onClick={handlePreviousStep} className="btn-secondary btn-large">
                      <ChevronLeft className="w-5 h-5" />
                      Indietro
                    </button>
                    <button
                      onClick={handleNextStep}
                      disabled={!validateStep('shipping')}
                      className="btn-primary btn-large"
                    >
                      Continua
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="bg-surface-card rounded-2xl p-6">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">
                      Metodo di Pagamento
                    </h2>

                    <div className="space-y-3">
                      <label
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                          formData.paymentMethod === 'stripe'
                            ? 'border-gold bg-gold/10'
                            : 'border-white/10 hover:border-gold/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="stripe"
                            checked={formData.paymentMethod === 'stripe'}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-gold focus:ring-gold/50"
                          />
                          <div>
                            <p className="font-medium text-white">Carta di Credito / Debito</p>
                            <p className="text-sm text-text-secondary">
                              Visa, Mastercard, American Express
                            </p>
                          </div>
                        </div>
                        <CreditCard className="w-6 h-6 text-text-muted" />
                      </label>

                      <label
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                          formData.paymentMethod === 'paypal'
                            ? 'border-gold bg-gold/10'
                            : 'border-white/10 hover:border-gold/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="paypal"
                            checked={formData.paymentMethod === 'paypal'}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-gold focus:ring-gold/50"
                          />
                          <div>
                            <p className="font-medium text-white">PayPal</p>
                            <p className="text-sm text-text-secondary">
                              Paga con il tuo account PayPal
                            </p>
                          </div>
                        </div>
                        <div className="w-16 h-6 bg-white rounded flex items-center justify-center text-xs font-bold text-blue-600">
                          PayPal
                        </div>
                      </label>

                      <label
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                          formData.paymentMethod === 'bank_transfer'
                            ? 'border-gold bg-gold/10'
                            : 'border-white/10 hover:border-gold/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="bank_transfer"
                            checked={formData.paymentMethod === 'bank_transfer'}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-gold focus:ring-gold/50"
                          />
                          <div>
                            <p className="font-medium text-white">Bonifico Bancario</p>
                            <p className="text-sm text-text-secondary">
                              Riceverai i dati via email
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
                      <p className="text-error">{error}</p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between">
                    <button onClick={handlePreviousStep} className="btn-secondary btn-large">
                      <ChevronLeft className="w-5 h-5" />
                      Indietro
                    </button>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={!validateStep('payment') || isSubmitting}
                      className="btn-primary btn-large"
                    >
                      {isSubmitting ? (
                        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Completa Ordine
                          <Check className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-surface-card rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-xl font-semibold text-white mb-6">
                Riepilogo Ordine
              </h2>

              {/* Items */}
              <div className="space-y-4 max-h-64 overflow-y-auto mb-6">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0">
                      {item.product?.imageUrl && (
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product?.name || 'Product'}
                          fill
                          className="object-cover"
                        />
                      )}
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-primary text-xs font-bold rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.product?.name}</p>
                      {item.variant && (
                        <p className="text-xs text-text-muted">{item.variant.name}</p>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gold">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotale</span>
                  <span>{formatPrice(cart?.subtotal || 0)}</span>
                </div>

                {cart?.discount && cart.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Sconto</span>
                    <span>-{formatPrice(cart.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-text-secondary">
                  <span>Spedizione</span>
                  <span>
                    {selectedShippingMethod
                      ? selectedShippingMethod.baseCost === 0
                        ? 'Gratis'
                        : formatPrice(selectedShippingMethod.baseCost)
                      : '-'}
                  </span>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between text-white font-semibold text-lg">
                  <span>Totale</span>
                  <span className="text-gold">
                    {formatPrice(
                      (cart?.subtotal || 0) -
                        (cart?.discount || 0) +
                        (selectedShippingMethod?.baseCost || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
