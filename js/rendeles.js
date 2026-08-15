import { supabase, isSupabaseConfigured } from './supabase.js';

let currentShipmentId = null;
let currentShipmentData = null;
let isEditMode = false;

function getShipmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getStatusLabel(status) {
  const labels = {
    'order_received': 'Rendelés fogadva',
    'out_for_delivery': 'Szállítás alatt',
    'courier_on_way': 'Futár úton',
    'delivered': 'Kiszállítva'
  };
  return labels[status] || status;
}

async function loadShipmentDetails() {
  if (!isSupabaseConfigured()) return;

  const shipmentId = getShipmentIdFromUrl();
  if (!shipmentId) {
    const label = document.getElementById('selectedShipment');
    if (label) label.textContent = 'Hiányzó rendelés azonosító.';
    return;
  }

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .maybeSingle();

  if (error || !data) {
    const label = document.getElementById('selectedShipment');
    if (label) label.textContent = 'A rendelés nem található.';
    return;
  }

  currentShipmentId = shipmentId;
  currentShipmentData = data;

  displayShipmentDetails(data);

  const label = document.getElementById('selectedShipment');
  if (label) {
    label.textContent = `Rendelés: ${data.tracking_number}`;
  }
}

function displayShipmentDetails(data) {
  const fields = {
    detailTrackingNumber: data.tracking_number,
    detailCustomerName: data.customer_name,
    detailCustomerPhone: data.customer_phone,
    detailCustomerEmail: data.customer_email,
    detailCity: data.city,
    detailStreet: data.street,
    detailHouseNumber: data.house_number,
    detailPostalCode: data.postal_code,
    detailNotes: data.notes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
    }
  });

  const statusSelect = document.getElementById('detailStatus');
  if (statusSelect) {
    statusSelect.value = data.status;
  }

  const createdAtInput = document.getElementById('detailCreatedAt');
  if (createdAtInput) {
    createdAtInput.value = formatDate(data.created_at);
  }

  const deliveredAtInput = document.getElementById('detailDeliveredAt');
  if (deliveredAtInput) {
    deliveredAtInput.value = formatDate(data.delivered_at);
  }
}

function toggleEditMode() {
  isEditMode = !isEditMode;

  const editButton = document.getElementById('editModeToggleButton');
  const saveButton = document.getElementById('saveChangesButton');
  const cancelButton = document.getElementById('cancelEditButton');
  const editableFields = document.querySelectorAll('.editable-field');

  if (isEditMode) {
    editButton.style.display = 'none';
    saveButton.style.display = 'inline-block';
    cancelButton.style.display = 'inline-block';
    
    // Összes szerkeszthető mező engedélyezése
    editableFields.forEach(field => {
      if (field.tagName === 'SELECT') {
        field.disabled = false;
      } else {
        field.removeAttribute('readonly');
      }
    });
  } else {
    editButton.style.display = 'inline-block';
    saveButton.style.display = 'none';
    cancelButton.style.display = 'none';
    
    // Összes szerkeszthető mező letiltása
    editableFields.forEach(field => {
      if (field.tagName === 'SELECT') {
        field.disabled = true;
      } else {
        field.setAttribute('readonly', '');
      }
    });
    
    // Visszaállítás az eredeti adatokra
    displayShipmentDetails(currentShipmentData);
  }
}

async function saveChanges() {
  if (!currentShipmentId || !isSupabaseConfigured()) return;

  const status = document.getElementById('detailStatus')?.value;
  const customerName = document.getElementById('detailCustomerName')?.value;
  const customerPhone = document.getElementById('detailCustomerPhone')?.value;
  const customerEmail = document.getElementById('detailCustomerEmail')?.value;
  const city = document.getElementById('detailCity')?.value;
  const street = document.getElementById('detailStreet')?.value;
  const houseNumber = document.getElementById('detailHouseNumber')?.value;
  const postalCode = document.getElementById('detailPostalCode')?.value;
  const notes = document.getElementById('detailNotes')?.value;
  const deliveredAtValue = document.getElementById('detailDeliveredAt')?.value;

  // Dátum feldolgozása
  let deliveredAt = null;
  if (deliveredAtValue && deliveredAtValue.trim()) {
    // YYYY-MM-DD HH:mm formátumból ISO formátumra konvertálunk
    const [datePart, timePart] = deliveredAtValue.split(' ');
    if (datePart && timePart) {
      const dateStr = `${datePart}T${timePart}:00`;
      deliveredAt = new Date(dateStr).toISOString();
    }
  }

  try {
    const updatePayload = {
      status: status,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      city: city,
      street: street,
      house_number: houseNumber,
      postal_code: postalCode,
      notes: notes,
      updated_at: new Date().toISOString()
    };

    if (deliveredAt) {
      updatePayload.delivered_at = deliveredAt;
    }

    const { error } = await supabase
      .from('shipments')
      .update(updatePayload)
      .eq('id', currentShipmentId);

    if (error) {
      alert('Hiba: ' + error.message);
      return;
    }

    alert('Rendelés adatai sikeresen frissítve!');
    
    // Újra betöltés
    await loadShipmentDetails();
    toggleEditMode();
  } catch (error) {
    alert('Hiba az adatok mentésekor: ' + error.message);
  }
}

function setupEventListeners() {
  const editButton = document.getElementById('editModeToggleButton');
  const saveButton = document.getElementById('saveChangesButton');
  const cancelButton = document.getElementById('cancelEditButton');

  editButton?.addEventListener('click', toggleEditMode);
  saveButton?.addEventListener('click', saveChanges);
  cancelButton?.addEventListener('click', toggleEditMode);
}

export function setupShipmentDetails() {
  loadShipmentDetails();
  setupEventListeners();
}

if (document.readyState !== 'loading') {
  setupShipmentDetails();
}
