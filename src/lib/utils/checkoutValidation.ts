import type {
  ShippingAddress,
  BillingAddress,
  PaymentMethod,
  CheckoutValidationErrors
} from '../types/checkout';
import { toCountryCode } from '$lib/data/countries';

export function validateShippingAddress(
  address: ShippingAddress
): Partial<Record<keyof ShippingAddress, string>> {
  const errors: Partial<Record<keyof ShippingAddress, string>> = {};

  if (!address.firstName || address.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }

  if (!address.lastName || address.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }

  if (!address.email || !isEmail(address.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!address.phone || !isPhoneNumber(address.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }

  if (!address.address || address.address.trim().length < 5) {
    errors.address = 'Please enter a complete address';
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Please enter a valid city';
  }

  if (!address.state || address.state.trim().length < 2) {
    errors.state = 'Please enter a valid state';
  }

  if (!address.zipCode || !isZipCode(address.zipCode)) {
    errors.zipCode = 'Please enter a valid ZIP code';
  }

  // A country we cannot resolve to an ISO-2 code cannot be shipped to, so it
  // is refused here rather than at the fulfilment relay, after payment.
  if (!address.country || !toCountryCode(address.country)) {
    errors.country = 'Please choose a country';
  }

  return errors;
}

export function validateBillingAddress(
  address: BillingAddress
): Partial<Record<keyof BillingAddress, string>> {
  const errors: Partial<Record<keyof BillingAddress, string>> = {};

  if (!address.firstName || address.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }

  if (!address.lastName || address.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }

  if (!address.address || address.address.trim().length < 5) {
    errors.address = 'Please enter a complete address';
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Please enter a valid city';
  }

  if (!address.state || address.state.trim().length < 2) {
    errors.state = 'Please enter a valid state';
  }

  if (!address.zipCode || !isZipCode(address.zipCode)) {
    errors.zipCode = 'Please enter a valid ZIP code';
  }

  // A country we cannot resolve to an ISO-2 code cannot be shipped to, so it
  // is refused here rather than at the fulfilment relay, after payment.
  if (!address.country || !toCountryCode(address.country)) {
    errors.country = 'Please choose a country';
  }

  return errors;
}

export function validatePaymentMethod(
  payment: PaymentMethod
): Partial<Record<keyof PaymentMethod, string>> {
  const errors: Partial<Record<keyof PaymentMethod, string>> = {};

  if (!payment.cardNumber || !isCreditCardNumber(payment.cardNumber)) {
    errors.cardNumber = 'Please enter a valid card number';
  }

  if (!payment.cardHolderName || payment.cardHolderName.trim().length < 3) {
    errors.cardHolderName = 'Please enter the card holder name';
  }

  if (!payment.expiryMonth || !isValidMonth(payment.expiryMonth)) {
    errors.expiryMonth = 'Please enter a valid month';
  }

  if (!payment.expiryYear || !isValidYear(payment.expiryYear)) {
    errors.expiryYear = 'Please enter a valid year';
  }

  if (!payment.cvv || !isValidCVV(payment.cvv)) {
    errors.cvv = 'Please enter a valid CVV';
  }

  // Additional validation for expiry date
  if (payment.expiryMonth && payment.expiryYear) {
    if (!isValidExpiryDate(payment.expiryMonth, payment.expiryYear)) {
      errors.expiryMonth = 'Card has expired';
      errors.expiryYear = 'Card has expired';
    }
  }

  return errors;
}

function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isPhoneNumber(phone: string): boolean {
  const phoneRegex = /^[\d\s\-()+]{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

function isZipCode(zipCode: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

function isCreditCardNumber(cardNumber: string): boolean {
  // Remove spaces and dashes
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');

  // Check if it's all digits and has valid length (13-19 digits)
  if (!/^\d{13,19}$/.test(cleanNumber)) {
    return false;
  }

  // Accept common test card numbers in development
  const testCardNumbers = [
    '4111111111111111', // Visa test card
    '5555555555554444', // Mastercard test card
    '378282246310005', // Amex test card
    '6011111111111117', // Discover test card
    '3530111333300000', // JCB test card
    '5105105105105100', // Mastercard test card
    '4242424242424242' // Stripe test card
  ];

  if (testCardNumbers.includes(cleanNumber)) {
    return true;
  }

  // Luhn algorithm validation
  return luhnCheck(cleanNumber);
}

function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

function isValidMonth(month: string): boolean {
  if (!month || month.trim() === '') {
    return false;
  }
  const monthNum = parseInt(month, 10);
  const isValid = !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
  return isValid;
}

function isValidYear(year: string): boolean {
  if (!year || year.trim() === '') {
    return false;
  }
  const currentYear = new Date().getFullYear();
  let yearNum = parseInt(year, 10);

  if (isNaN(yearNum)) {
    return false;
  }

  // Handle 2-digit year (YY format)
  if (yearNum < 100) {
    const currentCentury = Math.floor(currentYear / 100) * 100;
    yearNum = currentCentury + yearNum;
  }

  return yearNum >= currentYear && yearNum <= currentYear + 10;
}

function isValidCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

function isValidExpiryDate(month: string, year: string): boolean {
  if (!month || !year) {
    return false;
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const expMonth = parseInt(month, 10);
  let expYear = parseInt(year, 10);

  if (isNaN(expMonth) || isNaN(expYear)) {
    return false;
  }

  // Handle 2-digit year (YY format)
  if (expYear < 100) {
    const currentCentury = Math.floor(currentYear / 100) * 100;
    expYear = currentCentury + expYear;
  }

  if (expYear < currentYear) {
    return false;
  }

  if (expYear === currentYear && expMonth < currentMonth) {
    return false;
  }

  return true;
}

/**
 * Validates shipping and billing address only. Payment is no longer collected
 * in this form — checkout hands off to Stripe Checkout, which validates and
 * collects the card itself — so paymentMethod is not checked here even
 * though it's still part of CheckoutFormData for now.
 */
export function validateCheckoutForm(formData: {
  shippingAddress: ShippingAddress;
  billingAddress: BillingAddress;
  paymentMethod: PaymentMethod;
}): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};

  const shippingErrors = validateShippingAddress(formData.shippingAddress);
  if (Object.keys(shippingErrors).length > 0) {
    errors.shippingAddress = shippingErrors;
  }

  const billingErrors = validateBillingAddress(formData.billingAddress);
  if (Object.keys(billingErrors).length > 0) {
    errors.billingAddress = billingErrors;
  }

  return errors;
}
