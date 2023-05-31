import React from 'react';
import {
    Header, Grid, Divider, Button,
} from 'ui-react';
import { translate } from 'translateLib';
import { debounce } from 'lodash';
import ShowMoreButton from './ShowMoreButton';
import { LoadingState } from '../types';
import styles from './styles.module.scss';

export interface ElementsStructure {
    id: number
    name: string
}

export enum ElementSize {
    large = 'large',
    small = 'small',
}

interface JenericComponentProps<Element extends ElementsStructure> {
    title: string
    count?: number
    elements: Element[]
    withPagination?: boolean
    defaultShowMore?: boolean
    scrollContainer: React.RefObject<HTMLElement>
    withHead?: boolean
    elementSize?: ElementSize
    renderFunc(item: Element): JSX.Element
    getPaginationState?:() => LoadingState
    onPagination?(): void
}

function JenericComponent<Element extends ElementsStructure>(props: JenericComponentProps<Element>) {
    const {
        title,
        count,
        elements,
        elementSize,
        withPagination,
        defaultShowMore = false,
        scrollContainer,
        withHead = true,
        renderFunc,
        getPaginationState,
        onPagination,
    } = props;

    const contentRef = React.useRef<HTMLDivElement>(null);

    const [showAll, setShowAll] = React.useState<boolean>(defaultShowMore);
    const loadingState = getPaginationState ? getPaginationState() : undefined;

    const onChangeShows = React.useCallback((shows: boolean) => {
        setShowAll(shows);
    }, []);

    React.useEffect(() => {
        const scrollHandler = debounce(() => {
            if (!loadingState?.loading && onPagination
                && contentRef !== null && contentRef.current
                && scrollContainer !== null && scrollContainer.current) {
                const { scrollTop, clientHeight } = scrollContainer.current;
                const { scrollHeight } = contentRef.current;
                if (scrollHeight - (scrollTop + clientHeight) <= 35) onPagination();
            }
        }, 300);

        function setScrollHandler() {
            if (scrollContainer?.current) {
                scrollContainer.current.addEventListener('scroll', scrollHandler);
            }
        }
        function removeScrollHandler() {
            if (scrollContainer?.current) {
                scrollContainer.current.removeEventListener('scroll', scrollHandler);
            }
        }
        if (withPagination) setScrollHandler();

        return () => {
            if (withPagination) removeScrollHandler();
        };
    }, [loadingState?.loading, scrollContainer, withPagination, contentRef, onPagination]);

    return (
        <div ref={contentRef} className={styles.segment}>
            {withHead && (
                <div className={`${styles.segment_title} ${showAll ? styles.sticky : ''}`}>
                    <Grid>
                        <Grid.Column floated="left">
                            <Header as="h4">
                                {title}
                                {' '}
                                {count && `(${count})`}
                            </Header>
                        </Grid.Column>
                        <Grid.Column floated="right" textAlign="right">
                            <ShowMoreButton shows={showAll} onClick={onChangeShows} />
                        </Grid.Column>
                    </Grid>
                    <Divider />
                </div>
            )}
            <div className={styles.content}>
                <div className={`${showAll || !withHead ? '' : styles.hide} ${styles.wrapper} ${styles[elementSize || ElementSize.large]}`}>
                    <div className={styles.grid}>
                        {elements.map(renderFunc)}
                    </div>
                    {withPagination && loadingState && (
                        <div className={styles.load_more_wrap}>
                            <Button
                                basic={!loadingState.loading}
                                loading={loadingState.loading}
                                disabled={loadingState.loading}
                                content={translate`UPLOAD_MORE`}
                                onClick={onPagination}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default JenericComponent;
