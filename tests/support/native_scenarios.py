"""Named behavioral contracts for the real Codex/synthetic-provider reference suite.

The options are private fixture mechanics. Callers select a scenario ID; arbitrary
combinations are intentionally not a supported execution interface. No real account
or provider is a candidate in this catalogue.
"""

from dataclasses import dataclass
from types import MappingProxyType, SimpleNamespace


_BOOLEAN_OPTIONS = (
    'shutdown_services', 'admission_pause_running', 'admission_pause',
    'bounded_service_fault', 'bounded_service_db', 'bounded_service_stop',
    'bounded_service', 'bounded_worker', 'native_adapter_running_stop',
    'native_adapter_stop', 'native_adapter', 'managed_mcp', 'managed_guard',
    'rendered_environment', 'rendered_runtime', 'runtime_unit_loss',
    'encrypted_provider', 'conversation_reply', 'conversation_control',
    'wake_successor', 'revoke_restore', 'successor_native',
    'materialized_native', 'ack_timeout', 'control_native', 'revoke_native',
)


@dataclass(frozen=True)
class NativeScenario:
    purpose: str
    responsibilities: tuple[str, ...]
    flags: tuple[str, ...] = ()
    runtime_stop_signal: str = 'KILL'
    invalid_checkpoint: str | None = None
    restart: str | None = None
    image_kind: str = 'native'
    driver: str = 'native'

    def options(self, scenario_id):
        values = {name: name in self.flags for name in _BOOLEAN_OPTIONS}
        return SimpleNamespace(**values, scenario_id=scenario_id,
                               runtime_stop_signal=self.runtime_stop_signal,
                               invalid_checkpoint=self.invalid_checkpoint)


SCENARIOS = {}


def _add(name, purpose, responsibilities, *, extends=None, flags=(), **values):
    if name in SCENARIOS:
        raise ValueError('duplicate native scenario')
    inherited = SCENARIOS[extends].flags if extends else ()
    selected = tuple(dict.fromkeys((*inherited, *flags)))
    if set(selected) - set(_BOOLEAN_OPTIONS):
        raise ValueError('unknown native fixture behavior')
    domains = (*SCENARIOS[extends].responsibilities, *responsibilities) if extends else responsibilities
    SCENARIOS[name] = NativeScenario(purpose, tuple(dict.fromkeys(domains)), selected, **values)


_add('native.workflow', 'Native file, model, DB, MCP, upload and separate publication preserve receipts.',
     ('runtime', 'resources', 'gateway', 'core', 'cli'))
_add('native.controls', 'Steering and interruption use current authority and preserve checkpoint evidence.',
     ('runtime', 'gateway', 'core', 'cli'), flags=('control_native',))
_add('native.ack-recovery', 'A lost control acknowledgement preserves the effect and is reconciled once.',
     ('runtime', 'core'), extends='native.controls', flags=('ack_timeout',))
_add('native.revocation', 'Running native revocation prevents later work and successor authority reuse.',
     ('runtime', 'gateway', 'core'), flags=('revoke_native',))
_add('native.materialized', 'Managed immutable input is delivered and native controls retain provenance.',
     ('runtime', 'resources', 'core'), extends='native.controls', flags=('materialized_native',))
_add('native.successor', 'A new instance resumes the retained native checkpoint under current authority.',
     ('runtime', 'resources', 'core'), extends='native.materialized', flags=('successor_native',))
_add('native.checkpoint-identity', 'A checkpoint with wrong native identity is rejected before model use.',
     ('runtime', 'resources'), extends='native.successor', invalid_checkpoint='identity')
_add('native.checkpoint-truncated', 'Incomplete native state is rejected despite a valid artifact digest.',
     ('runtime', 'resources'), extends='native.successor', invalid_checkpoint='truncated')
_add('native.checkpoint-revoked', 'Revocation during checkpoint reading prevents native start.',
     ('runtime', 'resources', 'core'), extends='native.successor', flags=('revoke_restore',),
     image_kind='checkpoint-read-barrier')
_add('native.timer-successor', 'A timer admits one successor with retained inputs and current authority.',
     ('core', 'runtime'), extends='native.successor', flags=('wake_successor',))
_add('native.conversation-control', 'A retained human message can steer the currently authorized turn.',
     ('conversations', 'core', 'runtime'), extends='native.materialized', flags=('conversation_control',))
_add('native.conversation-reply', 'A native agent reads retained messages and publishes an addressed reply.',
     ('conversations', 'core', 'runtime'), extends='native.conversation-control', flags=('conversation_reply',))
_add('native.managed-mcp', 'Managed MCP reports Runtime-bound identity for the real native instance.',
     ('gateway', 'runtime', 'resources'), flags=('materialized_native', 'managed_mcp'))
_add('native.adapter', 'Native MCP admits a separate approved secretless adapter with provenance.',
     ('adapters', 'runtime', 'resources', 'core'), extends='native.managed-mcp', flags=('native_adapter',))
_add('native.adapter-stop-pending', 'Stopping pending activation denies claim and retains its reservation.',
     ('adapters', 'core', 'runtime'), extends='native.adapter', flags=('native_adapter_stop',))
_add('native.adapter-stop-running', 'Stopping an active adapter denies calls and observes its termination.',
     ('adapters', 'runtime', 'gateway'), extends='native.adapter', flags=('native_adapter_running_stop',))
_add('native.encrypted-provider', 'Only the external worker uses encrypted synthetic credentials and records usage.',
     ('credentials', 'resources', 'gateway'), flags=('encrypted_provider',))
_add('native.adapter-provider', 'Secretless submitted code uses a managed provider operation without credential access.',
     ('adapters', 'credentials', 'resources'), extends='native.adapter', flags=('encrypted_provider',))
_add('native.bounded-worker', 'One bounded worker handles source and independent adapter verification.',
     ('adapters', 'runtime'), extends='native.adapter', flags=('bounded_worker',))
_add('native.service', 'An approved bounded service handles retained conversations across instances.',
     ('adapters', 'conversations', 'runtime'), extends='native.adapter', flags=('bounded_service',))
_add('native.service-stop', 'Stopped service activation cannot process a further request.',
     ('adapters', 'runtime', 'core'), extends='native.service', flags=('bounded_service_stop',))
_add('native.service-db', 'Successive service instances retain one DB result per logical principal.',
     ('adapters', 'resources', 'runtime'), extends='native.service', flags=('bounded_service_db',))
_add('native.service-effect-recovery', 'Lost service completion is recovered from the receipt without duplicate DB effects.',
     ('adapters', 'resources', 'core'), extends='native.service', flags=('bounded_service_fault',))
_add('native.admission-pause', 'Admission pause, recovery inspection and explicit resume preserve obligations.',
     ('deployment', 'core', 'runtime'), extends='native.service-effect-recovery', flags=('admission_pause',))
_add('native.admission-running', 'Admission pause interrupts a live bounded service without clearing obligations.',
     ('deployment', 'core', 'runtime'), extends='native.service-stop', flags=('admission_pause_running',))
_add('native.service-shutdown', 'Both ingress paths close and paused service restart retains receipts and inventory.',
     ('deployment', 'gateway', 'core', 'runtime'), extends='native.admission-running', flags=('shutdown_services',))
_add('native.cold-restart', 'Clean PostgreSQL restart retains company rows, artifacts and paused authority.',
     ('recovery', 'deployment', 'resources'), extends='native.service-shutdown', restart='storage')
_add('native.bounded-load', 'Bounded API load records environment latency and control responsiveness.',
     ('deployment', 'gateway', 'core', 'cli'), extends='native.service-shutdown', restart='load')
_add('native.cold-successor', 'A cold restart permits a current-authority native successor without lost history.',
     ('recovery', 'runtime', 'core'), extends='native.service-shutdown', restart='native')
_add('native.system-services', 'Rendered system services recover paused inventory after cold DB restart.',
     ('deployment', 'recovery'), extends='native.service-shutdown', restart='services')
_add('native.managed-guard', 'An independent identity-bound systemd guard retains its fixed deadline.',
     ('runtime', 'deployment'), extends='native.managed-mcp', flags=('managed_guard',))
_add('native.runtime-loss', 'Runtime service loss leaves the independent guard able to contain its instance.',
     ('runtime', 'deployment'), extends='native.managed-guard', flags=('runtime_unit_loss',))
_add('native.runtime-stop', 'Graceful Runtime stop preserves closure evidence and returns compute only once.',
     ('runtime', 'deployment'), extends='native.runtime-loss', runtime_stop_signal='TERM')
_add('native.runtime-unit', 'The rendered Runtime unit supports independent guard and graceful stop.',
     ('runtime', 'deployment'), extends='native.runtime-loss', flags=('rendered_runtime',), runtime_stop_signal='TERM')
_add('native.environment', 'Installed protected services enforce ordering, store checks, identity and phased stop.',
     ('deployment', 'runtime', 'gateway', 'core', 'resources'), extends='native.runtime-unit',
     flags=('rendered_environment',), runtime_stop_signal='TERM')

_add('native.management-isolation', 'Two Runtime-bound instances preserve common human/agent authority, concurrent capacity and stopped-origin denial.',
     ('runtime', 'gateway', 'core', 'cli'), driver='management')
_add('native.install-faults', 'Installation rejects wrong review and overwrite, and resumes exact receipts after injected fsync failures.',
     ('deployment', 'recovery'), extends='native.environment', driver='installation', runtime_stop_signal='TERM')

_add('native.program-completion', 'Before materialization release no private authority or effects appear; natural program completion and compute-receipt replay preserve work and successor history.',
     ('runtime', 'resources', 'gateway', 'core', 'cli'), driver='program')

_add('native.kernel-contracts', 'SCM_RIGHTS preserves distinct close-on-exec handles and rejects missing descriptors and non-cgroup capabilities.',
     ('runtime',), driver='kernel')

SCENARIOS = MappingProxyType(SCENARIOS)


def select_scenario(name):
    try:
        return SCENARIOS[name]
    except KeyError as error:
        raise ValueError('unknown native scenario: ' + name) from error


def catalogue():
    return [{
        'id': name, 'purpose': value.purpose,
        'responsibilities': list(value.responsibilities),
        'environment': 'disposable-linux-arm64-root-systemd-docker-postgresql',
        'provider': 'synthetic-only', 'image_kind': value.image_kind,
        'restart': value.restart, 'driver': value.driver,
    } for name, value in SCENARIOS.items()]
