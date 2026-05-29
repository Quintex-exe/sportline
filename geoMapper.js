const clubs = require('./clubs.json');

const clubKeys =
  Object.keys(clubs)
    .sort((a,b) => b.length - a.length);

function detectClub(title = '') {

  const text = String(title).toLowerCase();

  for (const club of clubKeys) {

    if (!text.includes(club)) continue;

    const data = clubs[club];

    return {
      club,
      city: data.city || null,
      lat: Number(data.lat) || null,
      lng: Number(data.lng) || null,
      region: data.region || 'global'
    };
  }

  return null;
}

module.exports = {
  detectClub
};
