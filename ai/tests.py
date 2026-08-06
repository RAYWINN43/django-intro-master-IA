from django.test import SimpleTestCase

from ai.llama_service import LlamaService


class LlamaServiceTests(SimpleTestCase):
    def test_service_reads_configuration_from_env(self):
        service = LlamaService()

        self.assertTrue(service.api_key)
        self.assertEqual(service.model, "llama-3.3-70b-versatile")
