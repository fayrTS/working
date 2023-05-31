import React from 'react';
import { ICONS } from 'ui-react';
import { DateTime } from 'luxon';
import APIService from './services/api';
import { IntegrateFieldStructure } from '../FieldStore';
import {
    DateNextScaleMap,
    DateTimeNextScaleMap,
    isDateTypeField,
    isGroupableTypeField,
    isNumberTypeField,
    isUngroupableTypeField,
    MonthNextScaleMap,
    TimeNextScaleMap,
    WeekNextScaleMap,
} from '../utils';
import DateControls from '../components/DateControls';
import AllType, { ResponseStructure } from '../components/AllType';
import GroupableType, {GroupableResponseStructure } from '../components/GroupableType';
import DateType, { DateResponseStructure } from '../components/DateType';
import NumberType, { NumberResponseStructure } from '../components/NumberTypeCard';
import { Type, PeriodStructure, Sort } from '../components/types';
import { Period, Scale, FieldType } from '../types';
import { AllRequest } from '../types/api/values_all';
import { GroupableRequest } from '../types/api/values_groupable';
import { NumberRequest } from '../types/api/values_number';
import { DateScale, DateRequest } from '../types/api/values_date';
import { NOUNIQUE_DATA_MAP, UNIQUE_DATA_MAP } from '../constants';

interface FieldItemProps {
    id: number
    field: IntegrateFieldStructure
    period: PeriodStructure
    onResetDataScale(field: string): void
    onChangeSort(sort: Sort, field: string): void
    onChangeType(type: Type, field: string): void
    onChangeDataScale(period: Period, scale: Scale, field: string): void
}

function FieldItem(props: FieldItemProps) {
    const {
        id,
        field,
        period,
        onResetDataScale,
        onChangeSort,
        onChangeType,
        onChangeDataScale,
    } = props;

    const icons: {[key in DataType]?: ICONS[]} = React.useMemo(() => ({
        checkbox: ['check'],
        radio: ['bullseye'],
        date: ['calendar alternate outline'],
        datetime: ['calendar alternate outline', 'clock outline'],
        'datetime-local': ['calendar alternate outline', 'clock outline'],
        month: ['calendar outline'],
        week: ['calendar minus outline'],
        time: ['clock outline'],
        number: ['hashtag'],
        range: ['hashtag'],
        email: ['at'],
        text: ['text cursor'],
        color: ['eyedropper'],
        search: ['search'],
        tel: ['mobile alternate'],
        url: ['chain'],
        file: ['file outline'],
        image: ['image outline'],
        password: ['asterisk'],
        reset: ['redo'],
        submit: ['flag checkered'],
    }), []);

    const requestData = React.useMemo(() => ({
        id,
        name: field.name,
        page_size: 10,
        sort: field.sort,
        ...period,
    }), [field.name, field.sort, period, id]);
    /**
     * Взаимодействие с групируемыми данными
     */
    const onGroupableRequest = React.useCallback(async (fromId?: number) => {
        let result: GroupableResponseStructure = {
            items: [], total_count: 0, next_id: 0,
        };
        const data: GroupableRequest = {
            ...requestData, from_id: fromId,
        };
        /**
         * Используется сервис для api запросов
         */
        const response = await APIService.request({ url: 'values_groupable', data });
        if (response.data) {
            const { type, ...rest } = response.data;
            result = {
                ...result,
                ...rest,
                total_count: response.total_count || 0,
                next_id: response.next_id || 0,
            };
        }
        return result;
    }, [requestData]);

    /**
     * Взаимодействие с данными типа `date`
     */

    /**
     * Запрос данных для типа `date`
     */
    const onDateRequest = React.useCallback(async (fromId?: number) => {
        let result: DateResponseStructure = {
            items: [], total_count: 0, next_id: 0,
        };
        let data: DateRequest = {
            ...requestData,
            from_id: fromId,
        };
        if ('scale' in field) {
            data = { ...data, scale: field.scale, ...field.period };
        }
        const response = await APIService.request({ url: 'values_date', data });
        if (response.data) {
            const { type, ...rest } = response.data;
            result = {
                ...result,
                ...rest,
                total_count: response.total_count || 0,
                next_id: response.next_id || 0,
            };
        }
        return result;
    }, [field, requestData]);

    /**
     * Устанавливаем предыдущее значение масштабирования данных
     */
    const prevScale = React.useMemo(() => {
        /**
         * FieldType, DateScale - enum
         */
        if (field.type !== FieldType.time
            && field.type !== FieldType.week
            && field.type !== FieldType.month
            && 'scale' in field
        ) {
            if (field.scale === DateScale.month) return DateTime.fromISO(field.period.data_date_from).toFormat('yyyy');
            if (field.scale === DateScale.day) return DateTime.fromISO(field.period.data_date_from).toFormat('yyyy-MM');
            if (field.scale === DateScale.hour) return DateTime.fromISO(field.period.data_date_from).toFormat('yyyy-MM-dd');
            if (field.scale === DateScale.minute) return DateTime.fromISO(field.period.data_date_from).toFormat('yyyy-MM-dd HH:00');
        }
        return undefined;
    }, [field]);

    /**
     * Форматируем данные для даты и времени
     */
    const onDateTimeFormatting = React.useCallback((date: Date, scale: DateScale, withOffset?: boolean) => ({
        data_date_from: `${DateTime.fromJSDate(date).startOf(scale).toISO({ includeOffset: false })}${withOffset ? 'Z' : ''}`,
        data_date_to: `${DateTime.fromJSDate(date).endOf(scale).toISO({ includeOffset: false })}${withOffset ? 'Z' : ''}`,
    }), []);

    /**
     * Форматируем данные для времени
     */
    const onTimeFormatting = React.useCallback((time: string) => ({
        data_date_from: DateTime.fromFormat(time, 'HH').startOf('hour').toFormat('HH:mm'),
        data_date_to: DateTime.fromFormat(time, 'HH').endOf('hour').toFormat('HH:mm'),
    }), []);

    /**
     * Изменяем масштабирование данных на выбранное
     */
    const onChangeDateScaleDate = React.useCallback((value: string | number | Date) => {
        if (isDateTypeField(field)) {
            const date = new Date(value);
            if (field.type === FieldType.datetimeLocal) {
                const scale = 'scale' in field ? field.scale : DateScale.year;
                if (scale !== DateScale.minute) {
                    const dataPeriod = onDateTimeFormatting(date, scale);
                    onChangeDataScale(dataPeriod, DateTimeNextScaleMap[scale] || scale, field.title);
                }
            } else if (field.type === FieldType.date) {
                const scale = 'scale' in field ? field.scale : DateScale.year;
                if (scale !== DateScale.day) {
                    const dataPeriod = onDateTimeFormatting(date, scale, true);
                    onChangeDataScale(dataPeriod, DateNextScaleMap[scale] || scale, field.title);
                }
            } else if (field.type === FieldType.month) {
                const scale = 'scale' in field ? field.scale : DateScale.year;
                if (scale !== DateScale.month) {
                    const dataPeriod = onDateTimeFormatting(date, scale, true);
                    onChangeDataScale(dataPeriod, MonthNextScaleMap[scale] || scale, field.title);
                }
            } else if (field.type === FieldType.week) {
                const scale = 'scale' in field ? field.scale : DateScale.year;
                if (scale !== DateScale.week) {
                    const dataPeriod = onDateTimeFormatting(date, scale, true);
                    onChangeDataScale(dataPeriod, WeekNextScaleMap[scale] || scale, field.title);
                }
            } else if (field.type === FieldType.time) {
                const scale = 'scale' in field ? field.scale : DateScale.hour;
                if (scale !== DateScale.minute) {
                    const select = String(value);
                    const dataPeriod = onTimeFormatting(select);
                    onChangeDataScale(dataPeriod, TimeNextScaleMap[scale] || scale, field.title);
                }
            }
        }
    }, [field, onChangeDataScale, onDateTimeFormatting, onTimeFormatting]);

    /**
     * Проверяем блокировку контрола предыдущего периода
     */
    const isDisabledPrevControl: boolean = React.useMemo(() => {
        if ('scale' in field) {
            if (field.type === FieldType.time) return field.scale === DateScale.hour;
            return field.scale === DateScale.year;
        }
        return true;
    }, [field]);

    /**
     * Устанавливаем начальное масшатбирование
     */
    const setStartScale = React.useCallback(() => {
        onResetDataScale(field.title);
    }, [field.title, onResetDataScale]);

    /**
     * Вазвращаем к предыдущему масштабированию данных
     */
    const onChangePrevDataScale = React.useCallback((value: string) => {
        const date = new Date(value);
        if ('scale' in field) {
            if (field.scale === DateScale.month) {
                setStartScale();
            } else if (field.scale === DateScale.day) {
                const dataPeriod = onDateTimeFormatting(
                    date,
                    DateScale.month,
                );
                onChangeDataScale(dataPeriod, DateScale.month, field.title);
            } else if (field.scale === DateScale.hour) {
                const dataPeriod = onDateTimeFormatting(
                    date,
                    DateScale.day,
                );
                onChangeDataScale(dataPeriod, DateScale.day, field.title);
            } else if (field.scale === DateScale.minute) {
                const dataPeriod = onDateTimeFormatting(
                    date,
                    DateScale.hour,
                );
                onChangeDataScale(dataPeriod, DateScale.hour, field.title);
            }
        }
    }, [field, onChangeDataScale, onDateTimeFormatting, setStartScale]);

    /**
     * Взаимодействие с карточками типа 'number'
     */
    /**
     * Запрашиваем данные типа `number`
     */
    const onNumberRequest = React.useCallback(async (fromId?: number) => {
        let result: NumberResponseStructure = {
            items: [],
            median: 0,
            average: 0,
            next_id: 0,
        };
        const data: NumberRequest = {
            ...requestData,
            from_id: fromId,
        };
        const response = await APIService.request({ url: 'values_number', data });

        if (response.data) {
            const { type, ...rest } = response.data;
            result = {
                ...result,
                ...rest,
                next_id: response.next_id || 0,
            };
        }
        return result;
    }, [requestData]);

    /**
     * Взаимодействие с данными всех типов
     */
    const onDataRequest = React.useCallback(async (fromId?: number) => {
        let result: ResponseStructure = {
            items: [],
            total_count: 0,
            next_id: 0,
        };
        const data: AllRequest = {
            ...requestData,
            from_id: fromId,
        };

        const response = await APIService.request({ url: 'values_all', data });
        if (response.data) {
            const { type, ...rest } = response.data;
            result = {
                ...result,
                ...rest,
                total_count: response.total_count || 0,
                next_id: response.next_id || 0,
            };
        }

        return result;
    }, [requestData]);

    /**
     * Проверяем является ли поле уникальным
     */
    const uniqueDataField = React.useMemo(() => ['email', 'file', 'tel'].includes(field.type), [field.type]);

    /**
     * Формфтируем данные для отображения
     */
    const onFormattedDataField = React.useCallback((cell: string) => {
        /**
         * UNIQUE_DATA_MAP, NOUNIQUE_DATA_MAP, константы используемые в качестве мап для преображения данных
         */
        if (uniqueDataField && cell === 'name') {
            return UNIQUE_DATA_MAP[String(field.type)] || cell;
        }
        if (!uniqueDataField || (uniqueDataField && cell !== 'name')) {
            return NOUNIQUE_DATA_MAP[cell] || cell;
        }
        return cell;
    }, [field.type, uniqueDataField]);

    return (
        <>
            {isGroupableTypeField(field) && (
                <GroupableType
                    card={field}
                    getResponseData={onGroupableRequest}
                    icons={icons[field.type]}
                    onChangeChartType={onChangeType}
                    onChangeSort={onChangeSort}
                    onFormattedHeaderCell={onFormattedDataField}
                />
            )}
            {isDateTypeField(field) && (
                <DateType
                    card={field}
                    icons={icons[field.type]}
                    controls={(
                        <DateControls
                            prevDate={prevScale}
                            disabled={isDisabledPrevControl}
                            goFirstScale={setStartScale}
                            onChangeScale={onChangePrevDataScale}
                        />
                    )}
                    getResponseData={onDateRequest}
                    onChangeSort={onChangeSort}
                    onSelectDataPeriod={onChangeDateScaleDate}
                    onFormattedHeaderCell={onFormattedDataField}
                />
            )}
            {isNumberTypeField(field) && (
                <NumberType
                    card={field}
                    icons={icons[field.type]}
                    getResponseData={onNumberRequest}
                    onChangeSort={onChangeSort}
                    onFormattedHeaderCell={onFormattedDataField}
                />
            )}
            {isUngroupableTypeField(field) && (
                <AllType
                    card={field}
                    icons={icons[field.type]}
                    onChangeSort={onChangeSort}
                    getResponseData={onDataRequest}
                    onFormattedHeaderCell={onFormattedDataField}
                />
            )}
        </>
    );
}

export default FieldItem;
