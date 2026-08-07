const categoryLabels = {
  'Smileys & Emotion': 'وجوه',
  'People & Body': 'أشخاص',
  'Animals & Nature': 'حيوانات',
  'Food & Drink': 'طعام',
  'Travel & Places': 'سفر',
  'Activities': 'أنشطة',
  'Objects': 'أشياء',
  'Symbols': 'رموز',
  'Flags': 'أعلام',
}

function groupByCategory(emojis) {
  const groups = {}
  for (const item of emojis) {
    const key = item.group || 'أخرى'
    // Skip standalone modifier/component glyphs (skin tones, hair, etc.) from the picker.
    if (key === 'Component') continue
    if (!groups[key]) groups[key] = []
    groups[key].push(item.chars)
  }
  return Object.entries(groups).map(([name, items]) => ({
    name,
    label: categoryLabels[name] || name,
    emojis: items,
  }))
}

export async function loadEmojiCategories() {
  const module = await import('../data/emojis.json')
  const emojis = module.default || module
  return groupByCategory(emojis)
}
