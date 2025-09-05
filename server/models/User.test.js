const { UserModel, USER_ROLES } = require('./User');

describe('UserModel BSNR/LANR', () => {
  test('creates user with BSNR/LANR and authenticates by pair', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const model = new UserModel();
    const email = `u${Date.now()}@ex.com`;
    const user = await model.createUser({
      email,
      password: 'Passw0rd1',
      firstName: 'A',
      lastName: 'B',
      role: USER_ROLES.DOCTOR,
      bsnr: '123456789',
      lanr: '1234567',
    });
    expect(user.bsnr).toBe('123456789');
    expect(user.lanr).toBe('1234567');

    const auth = await model.authenticateUser(null, 'Passw0rd1', '123456789', '1234567');
    expect(auth.user.email).toBe(email);
    expect(auth.token).toBeDefined();
  });
});

