const LDTGenerator = require('./ldtGenerator');

describe('LDTGenerator', () => {
  test('includes BSNR and LANR in 8100 records', () => {
    const gen = new LDTGenerator();
    const content = gen.generateLDT([
      { id: 'r1', date: '2024-01-01', type: 'Blood Count', status: 'Final', patient: 'Test User', bsnr: '123456789', lanr: '1234567' }
    ], { labInfo: { name: 'Lab' }, provider: { bsnr: '123456789', lanr: '1234567' } });
    expect(content).toContain('81000201' + '123456789');
    expect(content).toContain('81000202' + '1234567');
  });
});

