/**
 * Equipment types for the equipment feature.
 *
 * Equipment represents a piece of equipment needed to fulfill a product order
 * (e.g., "Laser Engraver", "Embroidery Machine", "Heat Press").
 * Each equipment defines a set of required and optional fields that customers
 * must fill during checkout when ordering a product that uses that equipment.
 */

// --- Equipment Field Types ---

export type EquipmentFieldType =
  'text' | 'textarea' | 'select' | 'color' | 'number' | 'date' | 'image' | 'audio' | 'video';

// Re-export MediaRequirements from customization so consumers can use it
export type { MediaRequirements } from './customization';

import type { EquipmentCapabilities, EquipmentKind } from './equipmentCapabilities';
export type { EquipmentCapabilities, EquipmentKind } from './equipmentCapabilities';

/**
 * A piece of equipment available to a site.
 */
export interface Equipment {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** What the machine is. Null for a legacy free-form entry. */
  kind: EquipmentKind | null;
  make: string | null;
  model: string | null;
  /** The built-in catalog entry it was added from, if any. */
  catalogModelId: string | null;
  /** The site's own copy of the machine's capabilities. */
  capabilities: EquipmentCapabilities | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Data for creating a new piece of equipment.
 */
export interface CreateEquipmentData {
  name: string;
  description?: string;
  isActive?: boolean;
  kind?: EquipmentKind | null;
  make?: string | null;
  model?: string | null;
  catalogModelId?: string | null;
  capabilities?: EquipmentCapabilities | null;
}

/**
 * Data for updating an existing piece of equipment.
 */
export interface UpdateEquipmentData {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  kind?: EquipmentKind | null;
  make?: string | null;
  model?: string | null;
  catalogModelId?: string | null;
  capabilities?: EquipmentCapabilities | null;
}

/**
 * A field definition for a piece of equipment.
 * Defines what information is required/optional from the customer.
 */
export interface EquipmentField {
  id: string;
  equipmentId: string;
  name: string;
  fieldType: EquipmentFieldType;
  options: string[];
  placeholder: string | null;
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  defaultValue: string | null;
  sortOrder: number;
  mediaRequirements: import('./customization').MediaRequirements | null;
}

/**
 * Data for creating a new equipment field.
 */
export interface CreateEquipmentFieldData {
  equipmentId: string;
  name: string;
  fieldType: EquipmentFieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  sortOrder?: number;
  mediaRequirements?: import('./customization').MediaRequirements;
}

/**
 * Data for updating an existing equipment field.
 */
export interface UpdateEquipmentFieldData {
  name?: string;
  fieldType?: EquipmentFieldType;
  options?: string[];
  placeholder?: string | null;
  required?: boolean;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  defaultValue?: string | null;
  sortOrder?: number;
  mediaRequirements?: import('./customization').MediaRequirements | null;
}

/**
 * Association between a product and a piece of equipment.
 */
export interface ProductEquipment {
  id: string;
  productId: string;
  equipmentId: string;
  /** Which of the machine's sizes the product is made at (e.g. 'round-1.25'). */
  sizeId: string | null;
  sortOrder: number;
  createdAt: number;
}

/**
 * A product–equipment link with the names either side needs to show it: the
 * equipment page lists a machine's products, the product editor its machines.
 */
export interface ProductEquipmentLink extends ProductEquipment {
  productName: string;
  equipmentName: string;
  equipmentIsActive: boolean;
  capabilities: EquipmentCapabilities | null;
}

/**
 * Equipment with its field definitions, used when displaying equipment
 * on the storefront product page and during checkout.
 */
export interface EquipmentWithFields extends Equipment {
  fields: EquipmentField[];
}

/**
 * Customer-submitted equipment field values, stored in the cart per item.
 */
export interface CartItemEquipmentValue {
  equipmentId: string;
  equipmentName: string;
  fieldId: string;
  fieldName: string;
  fieldType: EquipmentFieldType;
  value: string;
}

// --- DB row types (snake_case matching D1 schema) ---

export interface DBEquipment {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  is_active: number;
  kind: string | null;
  make: string | null;
  model: string | null;
  catalog_model_id: string | null;
  capabilities: string | null;
  created_at: number;
  updated_at: number;
}

export interface DBEquipmentField {
  id: string;
  site_id: string;
  equipment_id: string;
  name: string;
  field_type: string;
  options: string | null;
  placeholder: string | null;
  required: number;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  default_value: string | null;
  sort_order: number;
  media_requirements: string | null;
  created_at: number;
  updated_at: number;
}

export interface DBProductEquipment {
  id: string;
  site_id: string;
  product_id: string;
  equipment_id: string;
  size_id: string | null;
  sort_order: number;
  created_at: number;
}

export interface DBOrderItemEquipmentValue {
  id: string;
  order_item_id: string;
  equipment_id: string;
  equipment_field_id: string;
  field_name: string;
  value: string;
  created_at: number;
}
