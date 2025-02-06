import { parseCommaSeparatedEnvVar } from './utils';

describe('parseCommaSeparatedEnvVar', () => {
  it('should parse a comma-separated environment variable into an array', () => {
    const envVariable = 'value1,value2,value3';
    const result = parseCommaSeparatedEnvVar(envVariable, 'TEST_ENV');
    expect(result).toEqual(['value1', 'value2', 'value3']);
  });

  it('should trim whitespace from each item', () => {
    const envVariable = ' value1 , value2 , value3 ';
    const result = parseCommaSeparatedEnvVar(envVariable, 'TEST_ENV');
    expect(result).toEqual(['value1', 'value2', 'value3']);
  });

  it('should throw an error if the environment variable is undefined', () => {
    expect(() => parseCommaSeparatedEnvVar(undefined, 'TEST_ENV')).toThrow('TEST_ENV required');
  });

  it('should throw an error if the environment variable is null', () => {
    expect(() => parseCommaSeparatedEnvVar(null, 'TEST_ENV')).toThrow('TEST_ENV required');
  });

  it('should return an array with a single empty string if the environment variable is an empty string', () => {
    const envVariable = '';
    const result = parseCommaSeparatedEnvVar(envVariable, 'TEST_ENV');
    expect(result).toEqual(['']);
  });
});
