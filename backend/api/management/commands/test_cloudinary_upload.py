import uuid
from pathlib import Path

import requests
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.core.files.storage import storages


class Command(BaseCommand):
    help = 'Upload an image and a PDF to Cloudinary and verify their HTTPS URLs.'

    def add_arguments(self, parser):
        parser.add_argument('--image', required=True, help='Path to a local image file.')
        parser.add_argument('--pdf', required=True, help='Path to a local PDF file.')

    def handle(self, *args, **options):
        image_path = Path(options['image'])
        pdf_path = Path(options['pdf'])
        if not image_path.is_file():
            raise CommandError(f'Image file not found: {image_path}')
        if not pdf_path.is_file():
            raise CommandError(f'PDF file not found: {pdf_path}')

        uploads = (
            (image_path, storages['default'], 'images'),
            (pdf_path, storages['raw_media'], 'raw'),
        )
        for path, storage, resource_type in uploads:
            destination = f'cloudinary-check/{uuid.uuid4().hex}/{path.name}'
            with path.open('rb') as source:
                saved_path = storage.save(destination, File(source, name=path.name))
            url = storage.url(saved_path)
            if not url.startswith('https://'):
                raise CommandError(f'{resource_type} upload did not return an HTTPS URL: {url}')
            try:
                response = requests.get(url, stream=True, timeout=20)
            except requests.RequestException as error:
                raise CommandError(f'Could not verify {resource_type} URL: {error}') from error
            if not response.ok:
                response.close()
                raise CommandError(
                    f'{resource_type} URL returned HTTP {response.status_code}: {url}'
                )
            response.close()
            self.stdout.write(self.style.SUCCESS(f'{resource_type}: {url} (HTTP {response.status_code})'))
