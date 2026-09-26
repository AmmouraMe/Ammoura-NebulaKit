import { describe, it, expect } from 'vitest';
import {
  validateShippingAddress,
  validateBillingAddress,
  validatePaymentMethod,
  validateCheckoutForm
} from './checkoutValidation';
import type { ShippingAddress, BillingAddress, PaymentMethod } from '../types/checkout';

describe('Checkout Validation', () => {
  describe('validateShippingAddress', () => {
    const validAddress: ShippingAddress = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '1234567890',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States'
    };

    it('should return no errors for valid address', () => {
      const errors = validateShippingAddress(validAddress);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should error on short first name', () => {
      const errors = validateShippingAddress({ ...validAddress, firstName: 'J' });
      expect(errors.firstName).toBeDefined();
    });

    it('should error on empty first name', () => {
      const errors = validateShippingAddress({ ...validAddress, firstName: '' });
      expect(errors.firstName).toBeDefined();
    });

    it('should error on short last name', () => {
      const errors = validateShippingAddress({ ...validAddress, lastName: 'D' });
      expect(errors.lastName).toBeDefined();
    });

    it('should error on empty last name', () => {
      const errors = validateShippingAddress({ ...validAddress, lastName: '' });
      expect(errors.lastName).toBeDefined();
    });

    it('should error on invalid email', () => {
      const errors = validateShippingAddress({ ...validAddress, email: 'invalid' });
      expect(errors.email).toBeDefined();
    });

    it('should error on email without @', () => {
      const errors = validateShippingAddress({ ...validAddress, email: 'nodomain.com' });
      expect(errors.email).toBeDefined();
    });

    it('should error on email without domain', () => {
      const errors = validateShippingAddress({ ...validAddress, email: 'user@' });
      expect(errors.email).toBeDefined();
    });

    it('should error on invalid phone', () => {
      const errors = validateShippingAddress({ ...validAddress, phone: '123' });
      expect(errors.phone).toBeDefined();
    });

    it('should accept phone with spaces and dashes', () => {
      const errors = validateShippingAddress({ ...validAddress, phone: '123-456-7890' });
      expect(errors.phone).toBeUndefined();
    });

    it('should error on short address', () => {
      const errors = validateShippingAddress({ ...validAddress, address: '123' });
      expect(errors.address).toBeDefined();
    });

    it('should error on empty address', () => {
      const errors = validateShippingAddress({ ...validAddress, address: '' });
      expect(errors.address).toBeDefined();
    });

    it('should error on short city', () => {
      const errors = validateShippingAddress({ ...validAddress, city: 'A' });
      expect(errors.city).toBeDefined();
    });

    it('should error on empty city', () => {
      const errors = validateShippingAddress({ ...validAddress, city: '' });
      expect(errors.city).toBeDefined();
    });

    it('should error on short state', () => {
      const errors = validateShippingAddress({ ...validAddress, state: 'N' });
      expect(errors.state).toBeDefined();
    });

    it('should error on empty state', () => {
      const errors = validateShippingAddress({ ...validAddress, state: '' });
      expect(errors.state).toBeDefined();
    });

    it('should error on invalid zipCode', () => {
      const errors = validateShippingAddress({ ...validAddress, zipCode: '123' });
      expect(errors.zipCode).toBeDefined();
    });

    it('should accept zipCode with hyphen', () => {
      const errors = validateShippingAddress({ ...validAddress, zipCode: '10001-1234' });
      expect(errors.zipCode).toBeUndefined();
    });

    it('should error on short country', () => {
      const errors = validateShippingAddress({ ...validAddress, country: 'U' });
      expect(errors.country).toBeDefined();
    });

    it('should error on a country that is not a country', () => {
      for (const country of ['Other', 'Freedonia', 'ZZ']) {
        const errors = validateShippingAddress({ ...validAddress, country });
        expect(errors.country).toBeDefined();
      }
    });

    it('should accept an ISO-2 code and a country name alike', () => {
      for (const country of ['US', 'JP', 'Japan', 'Brazil']) {
        const errors = validateShippingAddress({ ...validAddress, country });
        expect(errors.country).toBeUndefined();
      }
    });

    it('should error on empty country', () => {
      const errors = validateShippingAddress({ ...validAddress, country: '' });
      expect(errors.country).toBeDefined();
    });

    it('should handle trimmed whitespace in fields', () => {
      const errors = validateShippingAddress({ ...validAddress, firstName: '  ' });
      expect(errors.firstName).toBeDefined();
    });
  });

  describe('validateBillingAddress', () => {
    const validAddress: BillingAddress = {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States'
    };

    it('should return no errors for valid address', () => {
      const errors = validateBillingAddress(validAddress);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should error on short first name', () => {
      const errors = validateBillingAddress({ ...validAddress, firstName: 'J' });
      expect(errors.firstName).toBeDefined();
    });

    it('should error on short last name', () => {
      const errors = validateBillingAddress({ ...validAddress, lastName: 'D' });
      expect(errors.lastName).toBeDefined();
    });

    it('should error on short address', () => {
      const errors = validateBillingAddress({ ...validAddress, address: '123' });
      expect(errors.address).toBeDefined();
    });

    it('should error on short city', () => {
      const errors = validateBillingAddress({ ...validAddress, city: 'A' });
      expect(errors.city).toBeDefined();
    });

    it('should error on short state', () => {
      const errors = validateBillingAddress({ ...validAddress, state: 'N' });
      expect(errors.state).toBeDefined();
    });

    it('should error on invalid zipCode', () => {
      const errors = validateBillingAddress({ ...validAddress, zipCode: '123' });
      expect(errors.zipCode).toBeDefined();
    });

    it('should error on short country', () => {
      const errors = validateBillingAddress({ ...validAddress, country: 'U' });
      expect(errors.country).toBeDefined();
    });

    it('should error on a country that is not a country', () => {
      const errors = validateBillingAddress({ ...validAddress, country: 'Other' });
      expect(errors.country).toBeDefined();
    });
  });

  describe('validatePaymentMethod', () => {
    const validPayment: PaymentMethod = {
      type: 'credit-card',
      cardNumber: '4532015112830366', // Valid test card number
      cardHolderName: 'John Doe',
      expiryMonth: '12',
      expiryYear: '2027',
      cvv: '123'
    };

    it('should return no errors for valid payment', () => {
      const errors = validatePaymentMethod(validPayment);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should error on invalid card number', () => {
      const errors = validatePaymentMethod({ ...validPayment, cardNumber: '1234' });
      expect(errors.cardNumber).toBeDefined();
    });

    it('should error on card number with invalid Luhn check', () => {
      const errors = validatePaymentMethod({ ...validPayment, cardNumber: '4532015112830367' });
      expect(errors.cardNumber).toBeDefined();
    });

    it('should accept card number with spaces', () => {
      const errors = validatePaymentMethod({ ...validPayment, cardNumber: '4532 0151 1283 0366' });
      expect(errors.cardNumber).toBeUndefined();
    });

    it('should accept card number with dashes', () => {
      const errors = validatePaymentMethod({ ...validPayment, cardNumber: '4532-0151-1283-0366' });
      expect(errors.cardNumber).toBeUndefined();
    });

    it('should error on short card holder name', () => {
      const errors = validatePaymentMethod({ ...validPayment, cardHolderName: 'Jo' });
      expect(errors.cardHolderName).toBeDefined();
    });

    it('should error on invalid month (0)', () => {
      const errors = validatePaymentMethod({ ...validPayment, expiryMonth: '0' });
      expect(errors.expiryMonth).toBeDefined();
    });

    it('should error on invalid month (13)', () => {
      const errors = validatePaymentMethod({ ...validPayment, expiryMonth: '13' });
      expect(errors.expiryMonth).toBeDefined();
    });

    it('should accept valid month 01', () => {
      // Use a future year to ensure the card is not expired
      const currentYear = new Date().getFullYear();
      const errors = validatePaymentMethod({
        ...validPayment,
        expiryMonth: '01',
        expiryYear: String(currentYear + 1)
      });
      expect(errors.expiryMonth).toBeUndefined();
    });

    it('should accept valid month 12', () => {
      const errors = validatePaymentMethod({ ...validPayment, expiryMonth: '12' });
      expect(errors.expiryMonth).toBeUndefined();
    });

    it('should error on year in the past', () => {
      const errors = validatePaymentMethod({ ...validPayment, expiryYear: '2020' });
      expect(errors.expiryYear).toBeDefined();
    });

    it('should error on year too far in future', () => {
      const currentYear = new Date().getFullYear();
      const errors = validatePaymentMethod({
        ...validPayment,
        expiryYear: String(currentYear + 11)
      });
      expect(errors.expiryYear).toBeDefined();
    });

    it('should error on invalid CVV (2 digits)', () => {
      const errors = validatePaymentMethod({ ...validPayment, cvv: '12' });
      expect(errors.cvv).toBeDefined();
    });

    it('should error on invalid CVV (5 digits)', () => {
      const errors = validatePaymentMethod({ ...validPayment, cvv: '12345' });
      expect(errors.cvv).toBeDefined();
    });

    it('should accept 4-digit CVV', () => {
      const errors = validatePaymentMethod({ ...validPayment, cvv: '1234' });
      expect(errors.cvv).toBeUndefined();
    });

    it('should error on expired card (past month)', () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      let pastMonth = currentMonth - 1;
      if (pastMonth === 0) {
        pastMonth = 12;
      }

      const errors = validatePaymentMethod({
        ...validPayment,
        expiryMonth: String(pastMonth).padStart(2, '0'),
        expiryYear: String(currentYear)
      });

      if (currentMonth > 1) {
        expect(errors.expiryMonth).toBeDefined();
      }
    });

    it('should not error on current month and year', () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const errors = validatePaymentMethod({
        ...validPayment,
        expiryMonth: String(currentMonth).padStart(2, '0'),
        expiryYear: String(currentYear)
      });

      expect(errors.expiryMonth).toBeUndefined();
      expect(errors.expiryYear).toBeUndefined();
    });
  });

  describe('validateCheckoutForm', () => {
    const validFormData = {
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'United States'
      },
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'United States'
      },
      paymentMethod: {
        type: 'credit-card' as const,
        cardNumber: '4532015112830366',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: '2027',
        cvv: '123'
      }
    };

    it('should return no errors for valid form', () => {
      const errors = validateCheckoutForm(validFormData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return shipping address errors', () => {
      const errors = validateCheckoutForm({
        ...validFormData,
        shippingAddress: { ...validFormData.shippingAddress, firstName: '' }
      });
      expect(errors.shippingAddress).toBeDefined();
      expect(errors.shippingAddress?.firstName).toBeDefined();
    });

    it('should return billing address errors', () => {
      const errors = validateCheckoutForm({
        ...validFormData,
        billingAddress: { ...validFormData.billingAddress, city: '' }
      });
      expect(errors.billingAddress).toBeDefined();
      expect(errors.billingAddress?.city).toBeDefined();
    });

    it('does not validate payment method — Stripe Checkout collects and validates the card', () => {
      const errors = validateCheckoutForm({
        ...validFormData,
        paymentMethod: { ...validFormData.paymentMethod, cvv: '12' }
      });
      expect(errors.paymentMethod).toBeUndefined();
    });

    it('should return multiple section errors', () => {
      const errors = validateCheckoutForm({
        shippingAddress: { ...validFormData.shippingAddress, firstName: '' },
        billingAddress: { ...validFormData.billingAddress, city: '' },
        paymentMethod: { ...validFormData.paymentMethod, cvv: '12' }
      });
      expect(errors.shippingAddress).toBeDefined();
      expect(errors.billingAddress).toBeDefined();
      expect(errors.paymentMethod).toBeUndefined();
    });
  });

  describe('edge case payment validation', () => {
    it('should reject non-numeric expiry month (NaN branch)', () => {
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: 'abc',
        expiryYear: '2027',
        cvv: '123'
      });
      expect(errors.expiryMonth).toBeDefined();
    });

    it('should reject non-numeric expiry year (NaN branch)', () => {
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: 'xyz',
        cvv: '123'
      });
      expect(errors.expiryYear).toBeDefined();
    });

    it('should accept 2-digit year format', () => {
      const currentYear = new Date().getFullYear();
      const twoDigitYear = ((currentYear + 2) % 100).toString();
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: twoDigitYear,
        cvv: '123'
      });
      expect(errors.expiryYear).toBeUndefined();
    });

    it('should reject NaN expiry in isValidExpiryDate', () => {
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: 'not-a-number',
        expiryYear: 'also-not',
        cvv: '123'
      });
      expect(errors.expiryMonth).toBeDefined();
      expect(errors.expiryYear).toBeDefined();
    });

    it('should handle 2-digit year in expiry date validation', () => {
      const currentYear = new Date().getFullYear();
      const twoDigitFuture = ((currentYear + 3) % 100).toString();
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '06',
        expiryYear: twoDigitFuture,
        cvv: '123'
      });
      // Both month and year should be valid
      expect(errors.expiryMonth).toBeUndefined();
      expect(errors.expiryYear).toBeUndefined();
    });

    it('should reject expired card with same year but past month', () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      if (currentMonth > 1) {
        const errors = validatePaymentMethod({
          type: 'credit-card',
          cardNumber: '4111111111111111',
          cardHolderName: 'John Doe',
          expiryMonth: '01',
          expiryYear: currentYear.toString(),
          cvv: '123'
        });
        expect(errors.expiryMonth).toBe('Card has expired');
        expect(errors.expiryYear).toBe('Card has expired');
      }
    });

    it('should reject empty month after trim', () => {
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '   ',
        expiryYear: '2027',
        cvv: '123'
      });
      expect(errors.expiryMonth).toBeDefined();
    });

    it('should reject empty year after trim', () => {
      const errors = validatePaymentMethod({
        type: 'credit-card',
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: '   ',
        cvv: '123'
      });
      expect(errors.expiryYear).toBeDefined();
    });
  });
});
