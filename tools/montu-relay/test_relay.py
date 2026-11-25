import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import relay


class MirrorTests(unittest.TestCase):
    def test_ingress_only_parses_outer_slack_envelopes(self):
        text = """=== THREAD PARENT MESSAGE ===
From: Ana <ana@example.test> (UAAA)
Time: hoy
Message TS: 1000000000.000001
> Primer hallazgo

--- Reply 1 of 1 ---
From: Otra Persona (UBBB)
Time: hoy
Message TS: 1000000000.000002
> Una respuesta
> From: Nombre dentro del texto (UCCC)
> *Enviado usando* ChatGPT
"""
        self.assertEqual(
            relay.parse_messages(text),
            [
                ("1000000000.000001", "UAAA", "Ana", "Primer hallazgo"),
                (
                    "1000000000.000002",
                    "UBBB",
                    "Otra Persona",
                    "Una respuesta\nFrom: Nombre dentro del texto (UCCC)",
                ),
            ],
        )

    def test_export_retry_and_return_to_same_thread(self):
        with (
            tempfile.TemporaryDirectory() as temp,
            patch.object(relay, "ROOT", Path(temp)),
        ):
            config = dict(
                team="team_test",
                channel="channel",
                general="general",
                mail_thread="mail",
                slack_sender="user",
            )
            r = relay.Relay(config, None)
            first = dict(
                id=1,
                hilo="abc",
                referencia="SUP-test",
                titulo="Prueba",
                agente="Claude",
                persona="Ana",
                tipo="pregunta",
                texto="¿Qué falta?",
                enlace="/equipo/t/hilos/abc",
            )
            second = {**first, "id": 2, "texto": "Falta revisar.", "tipo": "hallazgo"}

            def feed(cmd, team, _, since):
                return {
                    "mensajes": [e for e in [first, second] if e["id"] > int(since)]
                }

            calls = []

            def send(tool, **args):
                calls.append(args)
                return {
                    "message_context": {"message_ts": f"1000000000.{len(calls):06d}"}
                }

            r.call = send
            # Second message came from Slack; copy only to the other channel.
            r.set("origin:2", "channel")
            with (
                patch.object(relay, "montu", side_effect=feed),
                patch.object(r, "milestone") as mail,
            ):
                r.export()
                r.export()
            self.assertEqual(
                [x["channel_id"] for x in calls], ["channel", "general", "general"]
            )
            self.assertEqual(calls[-1]["thread_ts"], "1000000000.000002")
            mail.assert_called_once_with(first)
            with self.assertRaises(ValueError):
                relay.Relay({**config, "channel": "other"}, None)
            r.db.close()


if __name__ == "__main__":
    unittest.main()
