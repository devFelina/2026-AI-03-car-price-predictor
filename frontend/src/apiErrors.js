const fallbackMessage = (status) => `Prediction request failed with status ${status}.`

function validationItemMessage(item) {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''

  const location = Array.isArray(item.loc)
    ? item.loc.filter((part) => typeof part === 'string' || typeof part === 'number').at(-1)
    : undefined
  const field = typeof item.field === 'string' || typeof item.field === 'number'
    ? item.field
    : location
  const message = typeof item.message === 'string'
    ? item.message.trim()
    : typeof item.msg === 'string'
      ? item.msg.trim()
      : ''

  if (!message) return ''
  return field === undefined || field === null || String(field).trim() === ''
    ? message
    : `${field}: ${message}`
}

export function apiErrorMessage(body, status) {
  const detail = body?.detail

  if (typeof detail === 'string' && detail.trim()) return detail.trim()

  const detailItems = Array.isArray(detail) ? detail : [detail]
  const messages = detailItems.map(validationItemMessage).filter(Boolean)
  return messages.length > 0 ? messages.join(' ') : fallbackMessage(status)
}
