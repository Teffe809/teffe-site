const MOCK_VEHICLES = {
  ABC1D23: {
    plate: 'ABC1D23',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    color: 'Prata',
    ownerType: 'Pessoa Juridica',
    status: 'mock_active',
  },
  TFF2026: {
    plate: 'TFF2026',
    brand: 'Volkswagen',
    model: 'Delivery Express',
    year: 2026,
    color: 'Branco',
    ownerType: 'Frota Teffe',
    status: 'mock_active',
  },
};

module.exports = {
  id: 'vehicle-identification-manual',
  name: 'Vehicle Identification Manual',
  version: '0.1.0',
  execute(input) {
    const fallback = {
      plate: input.plate,
      brand: 'Fiat',
      model: 'Strada',
      year: 2021,
      color: 'Branco',
      ownerType: 'Pessoa Juridica',
      status: 'mock_active',
    };

    return {
      source: 'mock',
      vehicle: MOCK_VEHICLES[input.plate] || fallback,
    };
  },
};
