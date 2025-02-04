export default {
  displayName: 'snapraid-runner-ts',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../coverage/snapraid-runner-ts',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'], 
};
