// Connect builds the view with the default classic JSX runtime: it uses neither the environment of the `build` script
// nor the connect.yaml values for the build. Local scripts and tests compile JSX the same way, so a missing React
// import fails here and not as "React is not defined" in the deployed panel (found in the Connect preview).
// [BCC-VIEW-1] [BCC-DEPLOY-10]
import packageJson from '../package.json';

describe('build scripts', () => {
  it.each(['start', 'build'] as const)(
    '%s uses the default JSX runtime, as the Connect build does',
    (script) => {
      expect(packageJson.scripts[script]).toBe(`mc-scripts ${script}`);
    }
  );
});
