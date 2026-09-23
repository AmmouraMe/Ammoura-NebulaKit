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

/**
 * A piece of equipment available to a site.
 */
export interface Equipment {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  isActive: boolean;
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
}

/**
 * Data for updating an existing piece of equipment.
 */
export interface UpdateEquipmentData {
  name?: string;
  description?: string | null;
  isActive?: boolean;
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
  sortOrder: number;
  createdAt: number;
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
