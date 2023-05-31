import { ParamsType, ValidateParam } from '../types';
import { TextFactory } from '../TextFactory';
import { LinkFactory } from '../LinkFactory';
import ImageFactory from '../ImageFactory';
import { ColorFactory } from '../ColorFactory';
import { PxFactory } from '../PxFactory';
import { NumberFactory } from '../NumberFactory';
import { PercentFactory } from '../PercentFactory';
import { TextAlignFactory } from '../TextAlignField';
import { FontFamilyFactory } from '../FontFamilyField';
import { BorderFactory } from '../BorderRadiusField';
import { PositionFactory } from '../PositionFactory';
import { AnimationFactory } from '../AnimationFactory';

export type OmitType<T> = Omit<T, 'type'>;

type ChangeMethods = {
    getType(): string | null
    /**
     * Меняет значения полей
     * @param value
     */
    onChangeValue: (value: ValidateParam['value']) => void
};

export type ComponentProps = {
    data: ValidateParam,
} & ChangeMethods;

export type FactoryProps<T extends ValidateParam> = {
    data: OmitType<T>
} & ChangeMethods;

export interface Factory {
    type: ParamsType,
    create(props: FactoryProps<ValidateParam>): JSX.Element,
}

class CompoFactory {
    factories: { [type in Factory['type']]?: Factory } = {};

    constructor() {
        this.registerFactories(
            new TextFactory(),
            new LinkFactory(),
            new ImageFactory(),
            new ColorFactory(),
            new PxFactory(),
            new NumberFactory(),
            new PercentFactory(),
            new TextAlignFactory(),
            new FontFamilyFactory(),
            new BorderFactory(),
            new PositionFactory(),
            new AnimationFactory(),
        );
    }

    /**
     * Создаем мапу всех доступных факторий
     * @param factories
     * @private
     */
    private registerFactories(...factories: Factory[]) {
        factories.forEach((factory) => {
            this.factories[factory.type] = factory;
        });
    }

    public component(props: ComponentProps) {
        const { data, ...methods } = props;
        const { type, ...params } = data;

        const createProps:FactoryProps<ValidateParam> = { data: params, ...methods };
        return this.factories[type]?.create(createProps);
    }
}

export default CompoFactory;
