const clubs = require('./clubs.json');

function detectClub(title = '') {

  const text = title.toLowerCase();

  for (const club of Object.keys(clubs)) {

    if (text.includes(club)) {

      return {
        club,
        city: clubs[club].city,
        lat: clubs[club].lat,
        lng: clubs[club].lng,
        region: clubs[club].region
      };

    }
  }

  return null;
}

module.exports = {
  detectClub
};
