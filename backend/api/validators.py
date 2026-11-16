import uuid
from pathlib import PurePath

from PIL import Image, UnidentifiedImageError
from rest_framework import serializers


MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_MIME_EXTENSIONS = {
    'image/jpeg': {'jpg', 'jpeg'},
    'image/png': {'png'},
    'image/webp': {'webp'},
}


def validate_uploaded_image(uploaded_file):
    extension = PurePath(uploaded_file.name).suffix.lower().lstrip('.')
    mime_type = getattr(uploaded_file, 'content_type', None)
    if uploaded_file.size > MAX_IMAGE_BYTES:
        raise serializers.ValidationError('Image exceeds the 5 MB size limit.')
    if not any(extension in extensions for extensions in IMAGE_MIME_EXTENSIONS.values()):
        raise serializers.ValidationError('Unsupported image file type.')
    if mime_type and (
        mime_type not in IMAGE_MIME_EXTENSIONS
        or extension not in IMAGE_MIME_EXTENSIONS[mime_type]
    ):
        raise serializers.ValidationError('Image content type does not match its file extension.')

    try:
        uploaded_file.seek(0)
        image = Image.open(uploaded_file)
        if image.width * image.height > 40_000_000:
            raise serializers.ValidationError('Image dimensions exceed the permitted limit.')
        image.verify()
        if image.format not in {'JPEG', 'PNG', 'WEBP'}:
            raise serializers.ValidationError('Unsupported image content.')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise serializers.ValidationError('The uploaded file is not a valid image.') from error
    finally:
        uploaded_file.seek(0)

    uploaded_file.name = f'{uuid.uuid4().hex}.{extension}'
    return uploaded_file


def listing_photo_upload_path(instance, filename):
    extension = PurePath(filename).suffix.lower()
    return f'listing_photos/{uuid.uuid4().hex}{extension}'


def profile_avatar_upload_path(instance, filename):
    extension = PurePath(filename).suffix.lower()
    return f'profile_avatars/{uuid.uuid4().hex}{extension}'


def message_attachment_upload_path(instance, filename):
    extension = PurePath(filename).suffix.lower()
    return f'message_attachments/{uuid.uuid4().hex}{extension}'
