document.getElementById('year').textContent = new Date().getFullYear();

// Public ASAP CRM intake (Supabase edge function asap-crm).
// Uses the publishable anon key only — never a service-role secret.
// Endpoint: POST /functions/v1/asap-crm/api/service-requests
// Source: citygangsix/asap-appliances-app publicServiceRequests.js
const CRM_INTAKE_URL =
  'https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/service-requests';
const CRM_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leGt5bXFhaHBrdnp6bHZpdmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM2ODIsImV4cCI6MjA5MjQ2OTY4Mn0.6hBplDhGzvVUDprTcuRXU66j8QHTd3hz-JSUiBpnnAM';
const QUOTE_SMS_NUMBER = '+15614643925';

function buildSmsBody(data) {
  return [
    'Hi AC Boss USA, I would like a quote.',
    '',
    `Name: ${data.get('name')}`,
    `Phone: ${data.get('phone')}`,
    `Service: ${data.get('service')}`,
    `ZIP: ${data.get('zip')}`,
    `Details: ${data.get('details') || 'Not provided'}`
  ].join('\n');
}

function openSmsFallback(data) {
  window.location.href =
    `sms:${QUOTE_SMS_NUMBER}?body=${encodeURIComponent(buildSmsBody(data))}`;
}

function setFormStatus(message, isError) {
  const note = document.querySelector('#quote-form .form-note');
  if (!note) return;
  note.textContent = message;
  note.classList.toggle('form-note-error', Boolean(isError));
}

function buildCrmPayload(data) {
  const name = String(data.get('name') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  const service = String(data.get('service') || '').trim();
  const zip = String(data.get('zip') || '').trim();
  const details = String(data.get('details') || '').trim();

  return {
    name,
    phone,
    serviceAddress: zip || 'Not provided',
    applianceType: service || 'AC service',
    issueSummary:
      details ||
      `Quote request from acbossinstall.com for ${service || 'AC service'}.`,
    preferredTiming: 'Not specified',
    // Do not claim ASAP Appliance SMS consent from this AC Boss form.
    smsConsent: false
  };
}

async function submitToCrm(payload) {
  const response = await fetch(CRM_INTAKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRM_ANON_KEY}`
    },
    body: JSON.stringify(payload)
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (!response.ok || !result || result.ok !== true) {
    const message =
      (result && result.message) ||
      `CRM intake failed (${response.status}).`;
    throw new Error(message);
  }

  return result;
}

document.getElementById('quote-form').addEventListener('submit', async function (event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button ? button.textContent : '';

  if (button) {
    button.disabled = true;
    button.textContent = 'Sending…';
  }
  setFormStatus('Sending your request to AC Boss USA…', false);

  try {
    const payload = buildCrmPayload(data);
    // Prefix so CRM notes clearly show AC Boss source.
    payload.issueSummary = `[acbossinstall.com / AC Boss USA] ${payload.issueSummary}`;
    const result = await submitToCrm(payload);
    setFormStatus(
      result.message
        ? `${result.message} We will follow up soon. You can also call (561) 464-3925.`
        : 'Request received. We will follow up soon. You can also call (561) 464-3925.',
      false
    );
    form.reset();
  } catch (error) {
    setFormStatus(
      'Could not reach the office system. Opening a text message instead…',
      true
    );
    openSmsFallback(data);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel || 'Send My Quote Request';
    }
  }
});
