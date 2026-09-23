import type { DesignElement } from '$lib/utils/designElements';

/**
 * Product customization zone defined by admin.
 * Represents a rectangular area on a product image where customers can place uploads.
 */
export interface ProductCustomizationZone {
  id: string;
  productId: string;
  mediaId: string | null;
  name: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  maxFileSize: number;
  allowedTypes: string[];
  sortOrder: number;
  /** Template print area this zone was materialized from, if any. */
  printAreaId: string | null;
}

/**
 * Data for creating a new customization zone.
 */
export interface CreateCustomizationZoneData {
  productId: string;
  mediaId?: string | null;
  name: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  sortOrder?: number;
  printAreaId?: string | null;
}

/**
 * Data for updating an existing customization zone.
 */
export interface UpdateCustomizationZoneData {
  name?: string;
  mediaId?: string | null;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  sortOrder?: number;
}

/**
 * Customer's customization for a single zone, stored in the cart.
 *
 * `elements` is the design as the studio holds it: a stack of pictures and
 * lines of text, each measured in inches on the product. Everything below it is
 * the older single-upload description of the *first image element*, still
 * written so that the cart, the order tables and the admin view keep working
 * unchanged for designs that are one picture — which is most of them.
 */
export interface CartItemCustomization {
  zoneId: string;
  zoneName: string;
  /** Every element the customer placed, bottom of the stack first. */
  elements?: DesignElement[];
  /** Stable across revisions of one design, so a store can group them. */
  designId?: string;
  /** How many times this design has been sent. First order is 1. */
  designRevision?: number;
  /**
   * Directly-renderable source for the customer's artwork. Now the R2-backed
   * `/api/media/...` URL of the full-resolution original (a `data:` URL only
   * when running without an R2 binding), NOT a downsampled preview — the
   * printed output is generated from this. Empty for a text-only design.
   */
  imageDataUrl: string;
  /** `media_library` id of the full-resolution original in R2. */
  mediaId: string | null;
  /** Pixel dimensions of the original, used for print-quality assessment. */
  naturalWidth: number;
  naturalHeight: number;
  originalFilename: string;
  offsetXPercent: number;
  offsetYPercent: number;
  scale: number;
  /** Clockwise rotation in degrees, applied about the design's centre. */
  rotation: number;
}

// --- Product Customization Fields ---
// Admin-defined input fields that customers fill in when ordering
// (e.g., "Enter name to engrave", "Choose font style", "Select color",
//  "Upload your design", "Record a voice message")

export type CustomizationFieldType =
  'text' | 'textarea' | 'select' | 'color' | 'number' | 'image' | 'audio' | 'video';

/**
 * Media quality requirements for image, audio, and video field types.
 * Allows admins to enforce minimum quality standards on customer uploads.
 */
export interface MediaRequirements {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types (e.g., ['image/png', 'image/jpeg']) */
  allowedMimeTypes?: string[];

  // Image-specific requirements
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Minimum aspect ratio (width / height, e.g., 1.0 for square) */
  minAspectRatio?: number;
  /** Maximum aspect ratio (width / height) */
  maxAspectRatio?: number;

  // Audio/Video-specific requirements
  /** Minimum duration in seconds */
  minDuration?: number;
  /** Maximum duration in seconds */
  maxDuration?: number;

  // Audio-specific requirements
  /** Minimum audio bitrate in kbps */
  minBitrate?: number;

  // Video-specific requirements
  /** Minimum video resolution (e.g., 720 for 720p) */
  minResolution?: number;
  /** Minimum video frame rate */
  minFrameRate?: number;
}

/**
 * Admin-defined customization field on a product.
 */
export interface ProductCustomizationField {
  id: string;
  productId: string;
  name: string;
  fieldType: CustomizationFieldType;
  options: string[];
  placeholder: string | null;
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  defaultValue: string | null;
  priceModifier: number;
  sortOrder: number;
  /** Media quality requirements for image/audio/video fields */
  mediaRequirements: MediaRequirements | null;
}

/**
 * Data for creating a new customization field.
 */
export interface CreateCustomizationFieldData {
  productId: string;
  name: string;
  fieldType: CustomizationFieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  priceModifier?: number;
  sortOrder?: number;
  mediaRequirements?: MediaRequirements;
}

/**
 * Data for updating an existing customization field.
 */
export interface UpdateCustomizationFieldData {
  name?: string;
  fieldType?: CustomizationFieldType;
  options?: string[];
  placeholder?: string | null;
  required?: boolean;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  defaultValue?: string | null;
  priceModifier?: number;
  sortOrder?: number;
  mediaRequirements?: MediaRequirements | null;
}

/**
 * Customer's field value for a single customization field, stored in the cart.
 */
export interface CartItemFieldValue {
  fieldId: string;
  fieldName: string;
  fieldType: CustomizationFieldType;
  value: string;
  priceModifier: number;
}
