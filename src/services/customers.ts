/**
 * Customer entity. One-to-many with Inspection (Inspection.customerId).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Customer } from '../types';

const KEY = '@roof_inspector:customers';

export async function loadCustomers(): Promise<Customer[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Customer[];
  } catch {
    return [];
  }
}

export async function saveCustomers(list: Customer[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const all = await loadCustomers();
  return all.find((c) => c.id === id) ?? null;
}

export async function upsertCustomer(c: Customer): Promise<void> {
  const all = await loadCustomers();
  const idx = all.findIndex((x) => x.id === c.id);
  const now = new Date().toISOString();
  if (idx === -1) {
    all.unshift({ ...c, createdAt: c.createdAt || now, updatedAt: now });
  } else {
    all[idx] = { ...c, updatedAt: now };
  }
  await saveCustomers(all);
}

export async function deleteCustomer(id: string): Promise<void> {
  const all = await loadCustomers();
  await saveCustomers(all.filter((c) => c.id !== id));
}

/**
 * Find a customer by exact name+address match, or create one. Used to back-fill
 * customers from existing inspections that pre-date the Customer entity.
 */
export async function findOrCreateCustomerByNameAddress(
  name: string,
  address: string,
  email = ''
): Promise<Customer> {
  const all = await loadCustomers();
  const trimmedName = name.trim();
  const trimmedAddr = address.trim();
  const existing = all.find(
    (c) =>
      c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
      c.address.trim().toLowerCase() === trimmedAddr.toLowerCase()
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const created: Customer = {
    id: uuidv4(),
    name: trimmedName,
    email: email.trim(),
    phone: '',
    address: trimmedAddr,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(created);
  await saveCustomers(all);
  return created;
}
