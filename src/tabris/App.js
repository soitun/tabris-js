import NativeObject from './NativeObject';
import {toValueString} from './Console';
import File from './File';
import {types} from './property-types';
import {getBytes} from './util';

const CERTIFICATE_ALGORITHMS = ['RSA2048', 'RSA4096', 'ECDSA256'];

export default class App extends NativeObject {

  get _nativeType() {
    return 'tabris.App';
  }

  /** @override */
  _nativeCreate(param) {
    if (param !== true) {
      throw new Error('App can not be created');
    }
    super._nativeCreate();
    this._nativeSet('encodeColor',
      (color) => types.ColorValue.encode(types.ColorValue.convert(color))
    );
    this._nativeSet('encodeFont',
      (font) => types.FontValue.encode(types.FontValue.convert(font))
    );
  }

  /**
   * @override
   * @param {string} name
   */
  _beforePropertyChange(name) {
    if (name === 'pinnedCertificates') {
      this.on('certificatesReceived', this._validateCertificate, this);
    }
  }

  get id() {
    return this._nativeGet('appId');
  }

  get debugBuild() {
    return this._nativeGet('debugBuild');
  }

  get version() {
    return this._nativeGet('version');
  }

  get versionCode() {
    return this._nativeGet('versionId');
  }

  launch(url) {
    return new Promise((resolve, reject) => {
      if (arguments.length < 1) {
        throw new Error('Not enough arguments to launch');
      }
      if (typeof url !== 'string') {
        throw new Error(`Invalid url: ${toValueString(url)} is not a string`);
      }
      this._nativeCall('launch', {
        url,
        onError: (err) => reject(new Error(err)),
        onSuccess: () => resolve()
      });
    });
  }

  share(data) {
    return new Promise((resolve, reject) => {
      if (arguments.length < 1) {
        throw new Error('The share functions requires a data object');
      }
      if (typeof data !== 'object'
        || (data.text == null && data.title == null && data.url == null && data.files == null)) {
        throw new TypeError(
          `Invalid data object: ${JSON.stringify(data)}. At least one of title, text, url or files is required`
        );
      }
      this._nativeCall('share', {
        data: this._prepareShareData(data),
        onSuccess: (target) => resolve(target),
        onError: (err) => reject(new Error(err))
      });
    });
  }

  _prepareShareData(data) {
    const shareData = {};
    if (data.title) {
      shareData.title = String(data.title);
    }
    if (data.text) {
      shareData.text = String(data.text);
    }
    if (data.url) {
      shareData.url = String(data.url);
    }
    if (data.files) {
      if (!Array.isArray(data.files)) {
        throw new Error('The share data "files" is not an array');
      }
      if (!data.files.every((file) => file instanceof File)) {
        throw new Error('The share data "files" array can only contain File objects');
      }
      shareData.files = data.files.map(file => ({name: file.name, type: file.type, data: getBytes(file)}));
    }
    return shareData;
  }

  getResourceLocation(path) {
    if (!this._resourceBaseUrl) {
      Object.defineProperty(this, '_resourceBaseUrl', {
        enumerable: false, writable: false, value: this._nativeGet('resourceBaseUrl')
      });
    }
    const subPath = path != null ? '/' + normalizePath('' + path) : '';
    return this._resourceBaseUrl + subPath;
  }

  dispose() {
    throw new Error('tabris.app can not be disposed');
  }

  reload(url) {
    this._nativeCall('reload', {url});
  }

  close() {
    this._nativeCall('close');
  }

  registerFont(alias, file) {
    if (arguments.length < 2) {
      throw new Error('Not enough arguments to register a font');
    }
    if (typeof alias !== 'string') {
      throw new Error(`Invalid alias: ${toValueString(alias)} is not a string`);
    }
    if (typeof file !== 'string') {
      throw new Error(`Invalid file path: ${toValueString(file)} is not a string`);
    }
    this._nativeCall('registerFont', {alias, file});
  }

  _validateCertificate(event) {
    const hashes = this.$pinnedCerts[event.host];
    if (hashes && !hashes.some(hash => event.hashes.includes(hash))) {
      event.preventDefault();
    }
  }

  get $pinnedCerts() {
    const certificates = this.pinnedCertificates;
    const hashes = {};
    for (const cert of certificates) {
      hashes[cert.host] = hashes[cert.host] || [];
      hashes[cert.host].push(cert.hash);
    }
    return hashes;
  }

}

NativeObject.defineProperties(App.prototype, {
  pinnedCertificates: {
    type: {
      convert: certificates => Object.freeze(certificates),
      encode(certificates) {
        // Do checks here instead of in convert to force an exception instead of a warning
        if (!Array.isArray(certificates)) {
          throw new Error('Not an Array');
        }
        for (const cert of certificates) {
          if (typeof cert.host !== 'string') {
            throw new Error(`Invalid host ${toValueString(cert.host)}`);
          }
          if (typeof cert.hash !== 'string' || !cert.hash.startsWith('sha256/')) {
            throw new Error(`Invalid hash ${toValueString(cert.hash)} for pinned certificate ${cert.host}`);
          }
          if (tabris.device.platform === 'iOS') {
            if (!('algorithm' in cert)) {
              throw new Error(`Missing algorithm for pinned certificate ${cert.host}`);
            }
            if (typeof cert.algorithm !== 'string' || CERTIFICATE_ALGORITHMS.indexOf(cert.algorithm) === -1) {
              throw new Error(`Invalid algorithm ${toValueString(cert.algorithm)} for pinned certificate ${cert.host}`);
            }
          }
        }
        return certificates;
      }
    },
    default: Object.freeze([])
  },
  trustedCertificates: {
    type: {
      convert: certificates => Object.freeze(certificates),
      encode(value) {
        // Do checks here instead of in convert to force an exception instead of a warning
        if (!Array.isArray(value)) {
          throw new Error('Not an Array');
        }
        for (let i = 0; i < value.length; i++) {
          const certificate = value[i];
          if (!(certificate instanceof ArrayBuffer)) {
            throw new Error(`certificate entry ${toValueString(certificate)} is not an ArrayBuffer`);
          }
        }
        return value;
      }
    },
    default: Object.freeze([])
  },
  idleTimeoutEnabled: {
    type: {
      convert(value) {
        if (!tabris.contentView) {
          throw new Error('The device property "idleTimeoutEnabled" can only be changed in main context.');
        }
        return types.boolean.convert(value);
      }
    },
    default: true
  }
});

NativeObject.defineEvents(App.prototype, {
  foreground: {native: true},
  background: {native: true},
  pause: {native: true},
  resume: {native: true},
  terminate: {native: true},
  keyPress: {native: true},
  backNavigation: {native: true},
  certificatesReceived: {native: true},
  continueWebActivity: {native: true}
});

export function create() {
  return new App(true);
}

function normalizePath(path) {
  return path.split(/\/+/).map((segment) => {
    if (segment === '..') {
      throw new Error(`Path ${toValueString(path)} must not contain ".."`);
    }
    if (segment === '.') {
      return '';
    }
    return segment;
  }).filter(string => !!string).join('/');
}
