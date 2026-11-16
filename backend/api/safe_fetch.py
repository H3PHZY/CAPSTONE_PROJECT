import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit


MAX_CLASSIFICATION_IMAGE_BYTES = 5 * 1024 * 1024


class UnsafeImageUrl(ValueError):
    pass


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, hostname, address, timeout):
        super().__init__(hostname, port=443, timeout=timeout, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        raw_socket = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)
        except Exception:
            raw_socket.close()
            raise


def fetch_public_image(url):
    if not isinstance(url, str) or len(url) > 2048:
        raise UnsafeImageUrl('Provide a valid image URL.')

    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as error:
        raise UnsafeImageUrl('Provide a valid image URL.') from error
    if (
        parsed.scheme != 'https'
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or port not in (None, 443)
        or parsed.fragment
    ):
        raise UnsafeImageUrl('Image URLs must use HTTPS on the standard port.')

    try:
        addresses = {
            entry[4][0]
            for entry in socket.getaddrinfo(
                parsed.hostname,
                443,
                type=socket.SOCK_STREAM,
            )
        }
    except (OSError, UnicodeError) as error:
        raise UnsafeImageUrl('The image host could not be resolved.') from error

    if not addresses:
        raise UnsafeImageUrl('The image host could not be resolved.')
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise UnsafeImageUrl('Image URLs must resolve to a public address.')

    address = sorted(addresses)[0]
    connection = PinnedHTTPSConnection(parsed.hostname, address, timeout=10)
    path = parsed.path or '/'
    if parsed.query:
        path = f'{path}?{parsed.query}'

    try:
        connection.request('GET', path, headers={'Host': parsed.hostname, 'Accept': 'image/*'})
        response = connection.getresponse()
        if response.status < 200 or response.status >= 300:
            raise UnsafeImageUrl('The image host did not return a successful response.')
        if not response.getheader('Content-Type', '').lower().split(';', 1)[0].startswith('image/'):
            raise UnsafeImageUrl('The URL did not return an image.')

        body = response.read(MAX_CLASSIFICATION_IMAGE_BYTES + 1)
        if len(body) > MAX_CLASSIFICATION_IMAGE_BYTES:
            raise UnsafeImageUrl('Image exceeds the 5 MB size limit.')
        return body
    except (OSError, ssl.SSLError, http.client.HTTPException) as error:
        raise UnsafeImageUrl('The image could not be retrieved securely.') from error
    finally:
        connection.close()
