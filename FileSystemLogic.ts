import {
    observable, action, computed, makeObservable,
} from 'mobx';
import loger from '../loger';
import {
    LoadingState, Search, Tags, Sort,
} from '../types';

type SelectMode = 'search' | 'id';

interface ContentStructure { id: number, name: string }

export interface ContentSelectStructure extends ContentStructure { selected: boolean }

interface FileSystemLogicInterface {
    getContentLength(): number
    getContent(): ContentSelectStructure[]
    getAlone(id: number): ContentSelectStructure | undefined
    getRemoveElements(): ContentSelectStructure[] | undefined
    getRemoveElement(id: number): ContentSelectStructure | undefined
    getTotalCount(): number
    getSort(): Sort
    getState(): LoadingState
    getPaginationState(): LoadingState
    getActionState(): LoadingState
    getIsSelectAllFlag(): boolean
    isSelectAll: boolean
    selectedCount: number
    rename(id: number, name: string): void
    remove(id?: number): void
    move(id?: number): void
    pagination(): void
    onChangeSort(sort: Sort): void
    onToggleSelected(id: number, selected: boolean): void
}

interface GalleryExternalData {
    id: number
    search?: Search
    uiTags?: Tags
}

export interface GalleryContentStoreProps extends GalleryExternalData {
    sort?: Sort
}

abstract class FileSystemLogic<
    Content extends ContentSelectStructure,
    Request extends { data: ContentStructure[], next_id: number, total_count: number },
> implements FileSystemLogicInterface {
    /**
     * Все сущности списка контента
     * @protected
     */
    @observable
    protected content: Content[];

    /**
     * Общее количество сущностей контента
     * @protected
     */
    @observable
    protected totalCount: number;

    /**
     * Следующий запрашиваемый элемнт контента при пагинации
     * @protected
     */
    protected nextId: number;

    /**
     * Значение сортировки для контента
     * @protected
     */
    @observable
    protected sort: Sort;

    /**
     * Состояние загрузки данных
     * @private
     */
    @observable
    private state: LoadingState;

    /**
     * Состояние загрузки данных при пагинации
     * @private
     */
    @observable
    private paginationState: LoadingState;

    /**
     * Состояние запроса действия (Удаление/Переименование/...)
     * @private
     */
    @observable
    private actionState: LoadingState;

    /**
     * Состояние выбора контента (выбраны все или нет)
     * @private
     */
    @observable
    protected selectedAll: boolean;

    /**
     * Все данные переданные снаружи
     * @protected
     */
    protected props: GalleryExternalData;

    /**
     * Удаленный при переименовании или перемещении элемент
     * @protected
     */
    @observable
    protected removedElements?: Content[];

    protected constructor(props: GalleryContentStoreProps) {
        const { sort, ...rest } = props;
        this.content = [];
        this.totalCount = 0;
        this.nextId = 0;
        this.sort = sort || { name: -1 };
        this.state = { loading: false, error: null };
        this.paginationState = { loading: false, error: null };
        this.actionState = { loading: false, error: null };
        this.selectedAll = false;
        this.props = rest;
        this.pagination = this.pagination.bind(this);
        this.remove = this.remove.bind(this);
        this.resetActionState = this.resetActionState.bind(this);

        this.init();
        makeObservable(this);
    }

    protected abstract requestContentData(): Promise<Request>;

    protected abstract requestContentMove(ids: number[], mode: SelectMode, toDir: number): Promise<void>;

    protected abstract requestContentRemove(ids: number[], mode: SelectMode): Promise<void>;

    protected abstract requestContentRename(id: number, name: string): Promise<void>;

    getContent = () => this.content;

    getRemoveElements = () => this.removedElements;

    getRemoveElement = (id: number) => this.removedElements?.find((item) => item.id === id);

    getContentLength = () => this.content.length;

    getAlone = (id: number) => this.content.find((item) => item.id === id);

    getTotalCount = () => this.totalCount;

    getSort = () => this.sort;

    getState = () => this.state;

    getPaginationState = () => this.paginationState;

    getActionState = () => this.actionState;

    getIsSelectAllFlag = () => this.selectedAll;

    /**
     * Возвращаем идентификаторы всех выбранных элементов
     */
    getSelectedIds = () => (this.selectedAll ? this.getAllUnselectedIds() : this.getAllSelectedIds());

    /**
     * Высчитываем выбран ли весь контент, или был снят выбор одного из видимой зоны
     */
    @computed
    get isSelectAll() {
        const isAllSelected = this.content.length > 0 && this.content.every((item) => item.selected);
        return (this.selectedAll && isAllSelected) || ((this.totalCount <= this.content.length) && isAllSelected);
    }

    /**
     * Получаем количество выбранных элемнтов контента
     */
    @computed
    get selectedCount() {
        if (this.selectedAll) return this.totalCount - this.content.filter((item) => !item.selected).length;
        return this.content && this.content.length > 0 ? this.content.filter((item) => item.selected).length : 0;
    }

    /**
     * Выполняем инициализацию стартовых данных
     */
    public async init() {
        await this.contentRequest();
    }

    /**
     * Получаем массив идентификаторов всех выбранных сущностей
     * @private
     */
    protected getAllSelectedIds() {
        return this.content.filter((item) => item.selected).map((item) => item.id);
    }

    /**
     * Получаем массив идентификаторов все невыбраных сущностей
     * @private
     */
    protected getAllUnselectedIds() {
        return this.content.filter((item) => !item.selected).map((item) => item.id);
    }

    /**
     * Сортируем данные
     * @param content
     * @param field
     * @param sorting
     * @protected
     */
    protected sortContent(content: Content[], field: keyof Content, sorting: keyof Sort) {
        const checkProp = (prop: Content[keyof Content]) => {
            if (typeof prop === 'string') return prop.toLowerCase();
            return prop;
        };

        const asc = (a: Content, b: Content) => {
            if (checkProp(a[field]) > checkProp(b[field])) return 1;
            if (checkProp(a[field]) < checkProp(b[field])) return -1;
            return 0;
        };
        const desc = (a: Content, b: Content) => {
            if (checkProp(a[field]) < checkProp(b[field])) return 1;
            if (checkProp(a[field]) > checkProp(b[field])) return -1;
            return 0;
        };
        return [...content].sort(this.sort[sorting] === 1 ? asc : desc);
    }

    /**
     * Изменяем имя конкретной сущности контента
     * @param id
     * @param name
     * @private
     */
    @action
    private renameContent(id: number, name: string) {
        const index = this.content.findIndex((item) => item.id === id);
        if (index !== -1) this.content[index].name = name;
    }

    /**
     * Устанавливаем значение для правильного дальнейшего отображения, после перемещения
     * @param element
     * @protected
     */
    @action
    protected setRemovedElement(element?: Content[]) {
        this.removedElements = element;
    }

    /**
     * Выполняем переименование сущности, сортируем контент, если выбрана сортировка по имени, если измененный объект,
     * становиться последним, удаляем и меняем идентификатор следующей запрашиваемой сущности при пагинации на
     * уже записанное значение и "-1"
     * @param id
     * @param name
     */
    public async rename(id: number, name: string) {
        try {
            this.changeActionState({ loading: true });

            await this.requestContentRename(id, name);

            this.renameContent(id, name);

            if ('name' in this.sort) {
                const newContent = this.sortContent(this.content, 'name', 'name');
                const lastElement = newContent.slice(-1);
                if (newContent.length > 1 && lastElement[0].id === id && this.totalCount > this.nextId) {
                    this.setContent(newContent.slice(0, -1));
                    this.setRemovedElement(lastElement);
                    this.setNextId(this.nextId - 1);
                }
            }

            this.changeActionState({ loading: false, error: null });
        } catch (e) {
            this.changeActionState({ loading: false, error: e });
            loger.write({
                message: 'Error removing content',
                details: e,
                level: 'error',
            });
        }
    }

    /**
     * Удаляем все выбранные сущности
     * @protected
     */
    protected removeContent(id?: number) {
        let result: Content[];
        if (id !== undefined || !this.selectedAll) {
            const ids = id ? [id] : this.getAllSelectedIds();
            const removed: Content[] = [];
            result = this.content.filter((entity) => {
                if (!ids.includes(entity.id)) return true;
                removed.push(entity);
                return false;
            });
            this.setTotalCount(this.totalCount - ids.length);
            if (removed.length > 0) this.setRemovedElement(removed);
            this.pagination();
        } else {
            result = this.content.filter((item) => this.getAllUnselectedIds().includes(item.id));
            this.setTotalCount(result.length);
        }
        this.setContent(result);
        this.setSelectedAll(false);
        this.toggleSelectAll(false);
    }

    /**
     * Возвращает массив всех выбранных элементов
     * @param id
     * @private
     */
    private getSelected(id?: number) {
        if (id !== undefined) return [id];
        return this.getSelectedIds();
    }

    /**
     * Удаляем элементы контента, индивидуально или все выбранные, в зависимости от переданого id
     * @param id
     */
    public async remove(id?: number) {
        const ids = this.getSelected(id);
        if (this.selectedAll || ids.length > 0) {
            try {
                this.changeActionState({ loading: true });

                await this.requestContentRemove(ids, this.selectedAll ? 'search' : 'id');
                this.removeContent(id);
                this.changeActionState({ loading: false, error: null });
            } catch (e) {
                this.changeActionState({ loading: false, error: e });
                loger.write({
                    message: 'Error removing contents',
                    details: e,
                    level: 'error',
                });
            }
        }
    }

    /**
     * Метод вызова запроса пагинации
     */
    public async pagination() {
        if (this.nextId > 0 && this.totalCount > this.nextId) await this.paginationRequest();
    }

    /**
     * Выбираем один из элементов контента
     * @param id
     * @param selected
     */
    @action.bound
    public onToggleSelected(id: number, selected: boolean) {
        const index = this.content.findIndex((item) => item.id === id);
        if (index !== -1) this.content[index].selected = selected;
    }

    /**
     * Устанавливаем значение выбора всех
     * @param selected
     * @protected
     */
    @action
    protected setSelectedAll(selected: boolean) {
        this.selectedAll = selected;
    }

    /**
     * Меняем данные о выборе для каждого видимого элемента
     * @param selected
     * @protected
     */
    @action
    protected toggleSelectAll(selected: boolean) {
        // eslint-disable-next-line no-param-reassign
        this.content.forEach((item) => { item.selected = selected; });
    }

    /**
     * Изменяем данные выбора всех исходя из того выбраны ли все элементы
     */
    public toggleSelectedAll(select: boolean) {
        this.setSelectedAll(select);
        this.toggleSelectAll(select);
    }

    /**
     * Меняем сортировку для контента
     * @param sort
     */
    @action.bound
    public async onChangeSort(sort: Sort) {
        this.sort = sort;
        this.setNextId(0);
        await this.contentRequest();
    }

    /**
     * Записываем данные контента
     * @param content
     * @protected
     */
    @action
    protected setContent(content: Content[]) {
        this.content = content;
    }

    /**
     * Добавляем данные контента (например при пагинации)
     * @param content
     * @private
     */
    @action
    private updateContent(content: Content[]) {
        this.content = [...this.content, ...content];
    }

    /**
     * Устанавливаем значение общего количества элемнтов в списке
     * @param totalCount
     * @protected
     */
    @action
    protected setTotalCount(totalCount: number) {
        this.totalCount = totalCount;
    }

    /**
     * Устанавливаем значение следующего запрашиваемого элемента для пагинации
     * @param nextId
     * @protected
     */
    protected setNextId(nextId: number) {
        this.nextId = nextId;
    }

    /**
     * Обновляем значение общей загрузки данных
     * @param state
     * @private
     */
    @action
    private changeState(state: Partial<LoadingState>) {
        this.state = { ...this.state, ...state };
    }

    /**
     * Обновляем состояние загрузки при пагинации
     * @param state
     * @private
     */
    @action
    private changePaginationState(state: Partial<LoadingState>) {
        this.paginationState = { ...this.paginationState, ...state };
    }

    /**
     * Обновляем состояние загрузки при выполнении дополнительных действий (удаление / переименование...)
     * @param state
     * @protected
     */
    @action
    protected changeActionState(state: Partial<LoadingState>) {
        this.actionState = { ...this.actionState, ...state };
    }

    /**
     * Обнуляем состояние запроса действия (удаления / переноса / переименования)
     */
    public resetActionState() {
        this.changeActionState({ loading: false, error: null });
    }

    /**
     * Добавляем необходимые для взаимодействия поля
     * @param content
     * @private
     */
    private convert(content: ContentStructure[]): Content[] {
        return content.map((item): Content => ({ ...item, selected: this.selectedAll }));
    }

    /**
     * Выполняем запрос на перемещение выбраного контента
     */
    public async move(toDir: number, id?: number) {
        const ids = this.getSelected(id);
        if (this.selectedAll || ids.length > 0) {
            try {
                this.changeActionState({ loading: true });
                await this.requestContentMove(ids, this.selectedAll ? 'search' : 'id', toDir);
                this.removeContent(id);
                this.changeActionState({ loading: false, error: null });
            } catch (e) {
                this.changeActionState({ loading: false, error: e });
                loger.write({
                    message: 'Error fetch to move content',
                    details: e,
                    level: 'error',
                });
            }
        }
    }

    /**
     * Производим запрос на пагинацию данных для контента
     * @private
     */
    private async paginationRequest() {
        try {
            this.changePaginationState({ loading: true });

            const response = await this.requestContentData();
            if (response.data) {
                this.setNextId(response.next_id);
                this.updateContent(this.convert(response.data));
            }
            this.changePaginationState({ loading: false, error: null });
        } catch (e) {
            this.changePaginationState({ loading: false, error: e });
            loger.write({
                message: 'Error fetch to get more content',
                details: e,
                level: 'error',
            });
        }
    }

    /**
     * Выполняем запрос на получение контента
     * @protected
     */
    protected async contentRequest() {
        try {
            this.changeState({ loading: true });

            const response = await this.requestContentData();
            if (response.data) {
                this.setTotalCount(response.total_count);
                this.setNextId(response.next_id);
                this.setContent(this.convert(response.data));
            }
            this.changeState({ loading: false, error: null });
        } catch (e) {
            this.changeState({ loading: false, error: e });
            loger.write({
                message: 'Error fetch to get content',
                details: e,
                level: 'error',
            });
        }
    }
}

export default FileSystemLogic;
