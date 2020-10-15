const fs = require('fs');
const forge = require('node-forge');
const path = require('path');

// 读取 CA证书，后面需要根据它创建域名证书
// 【win】该CA证书需要在mmc控制台中导入到“受信任的根证书颁发机构”
const caKey = forge.pki.decryptRsaPrivateKey(fs.readFileSync(path.resolve(__dirname, './cert/cakey.pem')));
const caCert = forge.pki.certificateFromPem(fs.readFileSync(path.resolve(__dirname, './cert/cacert.pem')));
const certCache = {}; // 缓存证书

/**
 * 根据所给域名生成对应证书
 */
module.exports = function createServerCertificate(domain) {
    if (certCache[domain]) {
        return certCache[domain];
    }
    const keys = forge.pki.rsa.generateKeyPair(2046);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = `${new Date().getTime()}`;
    cert.validity.notBefore = new Date();
    cert.validity.notBefore.setFullYear(
        cert.validity.notBefore.getFullYear() - 1,
    );
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
        cert.validity.notAfter.getFullYear() + 1,
    );
    cert.setIssuer(caCert.subject.attributes);
    let _subject = JSON.parse(JSON.stringify( caCert.subject.attributes[0] ));
    _subject.value = domain;
    cert.setSubject( [_subject] );
    cert.setExtensions([
        {
            name: 'basicConstraints',
            critical: true,
            cA: false,
        },
        {
            name: 'keyUsage',
            critical: true,
            digitalSignature: true,
            contentCommitment: true,
            keyEncipherment: true,
            dataEncipherment: true,
            keyAgreement: true,
            keyCertSign: true,
            cRLSign: true,
            encipherOnly: true,
            decipherOnly: true,
        },
        {
            name: 'subjectAltName',
            altNames: [
                {
                    type: 2,
                    value: domain,
                },
            ],
        },
        {
            name: 'subjectKeyIdentifier',
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true,
        },
        {
            name: 'authorityKeyIdentifier',
        },
    ]);
    cert.sign(caKey, forge.md.sha256.create());
    certCache[domain] = {
        key: keys.privateKey,
        cert,
    };
    return certCache[domain];
}
