#!/usr/bin/env python3
import plistlib
import sys
import uuid
from pathlib import Path

SHORTCUT_NAME = 'Ronda Salud'
OUTPUT_FILE = Path(__file__).with_name(f'{SHORTCUT_NAME}.xml')
PLACEHOLDER = '￼'
FIELD_SEPARATOR = '|'
DAYS_UNIT = 16
IS_IN_THE_LAST = 1001
IS = 4
HAS_NO_VALUE = 101
CONTROL_START = 0
CONTROL_END = 2
TEXT_ITEM = 0
SLEEP_DAYS = 7
DAILY_DAYS = 30
ICON_GLYPH = 61440
ICON_COLOR = 4282601983
NO_INPUT_MESSAGE = 'Abre este Atajo desde tu página de Ronda, con el botón «Enviar datos».'

SLEEP = {'type': 'Sleep', 'field': 'sleep_samples', 'days': SLEEP_DAYS, 'group_by': None, 'details': ['Start Date', 'End Date', 'Value'], 'note': 'Sueño de los últimos 7 días: una línea por tramo, con inicio, término y etapa.'}
STEPS = {'type': 'Steps', 'field': 'steps_by_day', 'days': DAILY_DAYS, 'group_by': 'Day', 'details': ['Start Date', 'Value'], 'note': 'Pasos de los últimos 30 días, agrupados por día: una línea por día.'}
ACTIVE_ENERGY = {'type': 'Active Calories', 'field': 'active_energy_by_day', 'days': DAILY_DAYS, 'group_by': 'Day', 'details': ['Start Date', 'Value'], 'note': 'Energía activa de los últimos 30 días, agrupada por día: una línea por día.'}
BLOCKS = [SLEEP, STEPS, ACTIVE_ENERGY]


def new_id():
    return str(uuid.uuid4()).upper()


def action(identifier, parameters=None):
    return {'WFWorkflowActionIdentifier': f'is.workflow.actions.{identifier}', 'WFWorkflowActionParameters': parameters or {}}


def output_of(action_id, name):
    return {'OutputUUID': action_id, 'OutputName': name, 'Type': 'ActionOutput'}


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text_with(template, values):
    positions = [index for index, character in enumerate(template) if character == PLACEHOLDER]
    if len(positions) != len(values):
        raise ValueError(f'{len(positions)} placeholders for {len(values)} values in {template!r}')
    ranges = {f'{{{position}, 1}}': value for position, value in zip(positions, values)}
    return {'Value': {'string': template, 'attachmentsByRange': ranges}, 'WFSerializationType': 'WFTextTokenString'}


def plain_text(text):
    return {'Value': {'string': text}, 'WFSerializationType': 'WFTextTokenString'}


def as_iso_date(value, with_time):
    return {**value, 'Aggrandizements': [{'Type': 'WFDateFormatVariableAggrandizement', 'WFDateFormatStyle': 'ISO 8601', 'WFISO8601IncludeTime': with_time}]}


def comment(text):
    return action('comment', {'WFCommentActionText': text})


def health_filter(sample_type, days):
    type_row = {'Bounded': True, 'Operator': IS, 'Property': 'Type', 'Removable': False, 'Values': {'Enumeration': {'Value': sample_type, 'WFSerializationType': 'WFStringSubstitutableState'}}}
    date_row = {'Bounded': True, 'Operator': IS_IN_THE_LAST, 'Property': 'Start Date', 'Removable': False, 'Values': {'Number': str(days), 'Unit': DAYS_UNIT}}
    return {
        'Value': {'WFActionParameterFilterPrefix': 1, 'WFContentPredicateBoundedDate': False, 'WFActionParameterFilterTemplates': [type_row, date_row]},
        'WFSerializationType': 'WFContentPredicateTableTemplate',
    }


def input_guard():
    group = new_id()
    shortcut_input = {'Type': 'Variable', 'Variable': attachment({'Type': 'ExtensionInput'})}
    return [
        action('conditional', {'GroupingIdentifier': group, 'WFControlFlowMode': CONTROL_START, 'WFCondition': HAS_NO_VALUE, 'WFInput': shortcut_input}),
        action('alert', {'WFAlertActionTitle': SHORTCUT_NAME, 'WFAlertActionMessage': plain_text(NO_INPUT_MESSAGE), 'WFAlertActionCancelButtonShown': False}),
        action('exit'),
        action('conditional', {'GroupingIdentifier': group, 'WFControlFlowMode': CONTROL_END}),
    ]


def health_block(block):
    find_id, loop_group, loop_end_id, line_id, combined_id = new_id(), new_id(), new_id(), new_id(), new_id()
    find_parameters = {'UUID': find_id, 'WFContentItemFilter': health_filter(block['type'], block['days'])}
    if block['group_by']:
        find_parameters['WFHKSampleFilteringGroupBy'] = block['group_by']

    detail_actions = []
    line_values = []
    for detail in block['details']:
        detail_id = new_id()
        detail_actions.append(action('properties.health.quantity', {'UUID': detail_id, 'WFContentItemPropertyName': detail, 'WFInput': attachment({'Type': 'Variable', 'VariableName': 'Repeat Item'})}))
        value = output_of(detail_id, detail)
        line_values.append(as_iso_date(value, with_time=block['group_by'] is None) if detail.endswith('Date') else value)

    line_template = FIELD_SEPARATOR.join(PLACEHOLDER for _ in line_values)
    actions = [
        comment(block['note']),
        action('filter.health.quantity', find_parameters),
        action('repeat.each', {'GroupingIdentifier': loop_group, 'WFControlFlowMode': CONTROL_START, 'WFInput': attachment(output_of(find_id, 'Health Samples'))}),
        *detail_actions,
        action('gettext', {'UUID': line_id, 'WFTextActionText': text_with(line_template, line_values)}),
        action('repeat.each', {'UUID': loop_end_id, 'GroupingIdentifier': loop_group, 'WFControlFlowMode': CONTROL_END}),
        action('text.combine', {'UUID': combined_id, 'WFTextSeparator': 'New Lines', 'text': attachment(output_of(loop_end_id, 'Repeat Results'))}),
    ]
    return actions, combined_id


def json_field(key, combined_id):
    return {'WFItemType': TEXT_ITEM, 'WFKey': plain_text(key), 'WFValue': text_with(PLACEHOLDER, [output_of(combined_id, 'Combined Text')])}


def send_and_show(fields):
    request_id, dictionary_id, message_id = new_id(), new_id(), new_id()
    return [
        comment('Envía todo en un solo envío a la dirección que llega como entrada del Atajo y muestra la respuesta de Ronda.'),
        action(
            'downloadurl',
            {
                'UUID': request_id,
                'WFURL': text_with(PLACEHOLDER, [{'Type': 'ExtensionInput'}]),
                'WFHTTPMethod': 'POST',
                'WFHTTPBodyType': 'JSON',
                'ShowHeaders': False,
                'WFJSONValues': {'Value': {'WFDictionaryFieldValueItems': fields}, 'WFSerializationType': 'WFDictionaryFieldValue'},
            },
        ),
        action('detect.dictionary', {'UUID': dictionary_id, 'WFInput': attachment(output_of(request_id, 'Contents of URL'))}),
        action('getvalueforkey', {'UUID': message_id, 'WFDictionaryKey': 'message', 'WFGetDictionaryValueType': 'Value', 'WFInput': attachment(output_of(dictionary_id, 'Dictionary'))}),
        action('showresult', {'Text': text_with(PLACEHOLDER, [output_of(message_id, 'Dictionary Value')])}),
    ]


def build():
    actions = [comment('Atajo compartido de Ronda. Se abre desde tu página de Ronda con el botón «Enviar datos», que le pasa tu dirección personal como entrada.'), *input_guard()]
    fields = []
    for block in BLOCKS:
        block_actions, combined_id = health_block(block)
        actions.extend(block_actions)
        fields.append(json_field(block['field'], combined_id))
    actions.extend(send_and_show(fields))
    return {
        'WFWorkflowActions': actions,
        'WFWorkflowClientVersion': '2700.0.4',
        'WFWorkflowHasOutputFallback': False,
        'WFWorkflowHasShortcutInputVariables': True,
        'WFWorkflowIcon': {'WFWorkflowIconGlyphNumber': ICON_GLYPH, 'WFWorkflowIconStartColor': ICON_COLOR},
        'WFWorkflowImportQuestions': [],
        'WFWorkflowInputContentItemClasses': ['WFStringContentItem', 'WFURLContentItem'],
        'WFWorkflowMinimumClientVersion': 900,
        'WFWorkflowMinimumClientVersionString': '900',
        'WFWorkflowName': SHORTCUT_NAME,
        'WFWorkflowOutputContentItemClasses': [],
        'WFWorkflowTypes': [],
    }


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else OUTPUT_FILE
    with target.open('wb') as handle:
        plistlib.dump(build(), handle, fmt=plistlib.FMT_XML, sort_keys=True)
    print(target)
